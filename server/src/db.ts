import pg from 'pg';
import dotenv from 'dotenv';
import { StoredUser, QueuedPacket } from './types.js'

dotenv.config();

const { Pool } = pg

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/blind_messenger',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initDb(): Promise<void> {
    const client = await pool.connect();

    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id VARCHAR(32) PRIMARY KEY,
                display_name VARCHAR(64) NOT NULL,
                public_key JSONB NOT NULL,
                last_seen BIGINT NOT NULL
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS pending_packets (
                id UUID PRIMARY KEY,
                recipient_id VARCHAR(32) NOT NULL,
                sender_id VARCHAR(32) NOT NULL,
                sender_display_name VARCHAR(64) NOT NULL,
                packet JSONB NOT NULL,
                timestamp BIGINT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_pending_packets_recipient
            ON pending_packets (recipient_id);
        `);

        console.log(`[Database] PostgreSQL tables and indexes verified.`);
    } finally {
        client.release()
    }
}

export async function upsertUser(user: StoredUser): Promise<void> {
    await pool.query(
        `
            INSERT INTO users (user_id, display_name, public_key, last_seen)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id)
            DO UPDATE SET
                display_name = EXCLUDED.display_name,
                public_key = EXCLUDED.public_key,
                last_seen = EXCLUDED.last_seen;
        `,
        [user.userId, user.displayName, JSON.stringify(user.publicKey), user.lastSeen]
    );
}

export async function getUser(userId: string): Promise<StoredUser | null> {
    const res = await pool.query(
        `SELECT user_id, display_name, public_key, last_seen FROM users WHERE user_id = $1;`,
        [userId]
    );

    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    return {
        userId: row.user_id,
        displayName: row.display_name,
        publicKey: typeof row.public_key === 'string' ? JSON.parse(row.public_key) : row.public_key,
        lastSeen: Number(row.last_seen),
    };
}

export async function enqueuePacket(recipientId: string, queued: QueuedPacket): Promise<void> {
  await pool.query(
    `
      INSERT INTO pending_packets (id, recipient_id, sender_id, sender_display_name, packet, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6);
    `,
    [
      queued.id,
      recipientId,
      queued.senderId,
      queued.senderDisplayName,
      JSON.stringify(queued.packet),
      queued.timestamp,
    ]
  );
}

export async function drainMailbox(recipientId: string): Promise<QueuedPacket[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const res = await client.query(
      `
        SELECT id, sender_id, sender_display_name, packet, timestamp 
        FROM pending_packets 
        WHERE recipient_id = $1 
        ORDER BY timestamp ASC;
      `,
      [recipientId]
    );

    if (res.rows.length > 0) {
      await client.query(
        `DELETE FROM pending_packets WHERE recipient_id = $1;`,
        [recipientId]
      );
    }

    await client.query('COMMIT');

    return res.rows.map((row) => ({
      id: row.id,
      senderId: row.sender_id,
      senderDisplayName: row.sender_display_name,
      packet: typeof row.packet === 'string' ? JSON.parse(row.packet) : row.packet,
      timestamp: Number(row.timestamp),
    }));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}