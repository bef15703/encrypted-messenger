import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import {
    ClientToServerEvents,
    ServerToClientEvents,
    UserSession,
} from './types.js';
import { StoredUser, QueuedPacket } from './types.js';
import { initDb, upsertUser, getUser, enqueuePacket, drainMailbox, pool } from './db.js';
import { timeStamp } from 'console';

dotenv.config()

const app = express();
app.use(cors());

app.get('/health', (_req, res) => {
    res.status(200).json({status: 'ok', timestamp: Date.now()});
});

const server = http.createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: {
        origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
        methods: ['GET', 'POST'],
    },
});

const sessionsByUserId = new Map<string, UserSession>();
const userIdsBySocketId = new Map<string, string>();



io.on('connection', (socket) => {
    console.log(`[Connect] Socket ID: ${socket.id}`);

    socket.on('register_identity', async ({userId, displayName, publicKey}, callback) => {
        const cleanId = userId.trim().toUpperCase();
        const cleanName = displayName.trim();

        if (!cleanId || !cleanName || !publicKey) {
            return callback({
                success: false,
                error: `userId, displayName, and publicKey are all required.`
            });
        }

        const existing = sessionsByUserId.get(cleanId);
        if (existing && existing.socketId != socket.id) {
            return callback({
                success: false,
                error: `This User ID is already active in another session.`
            });
        }

        const session: UserSession = {
            userId: cleanId,
            displayName: cleanName,
            socketId: socket.id,
            publicKey
        };

        sessionsByUserId.set(cleanId, session);
        userIdsBySocketId.set(socket.id, cleanId);

        try {
            await upsertUser({
                userId: cleanId,
                displayName: cleanName,
                publicKey,
                lastSeen: Date.now()
            });

            console.log(`[Registered] "${cleanName}" (${cleanId}) mapped to socket ${socket.id}`);

            callback({success: true});

            socket.broadcast.emit('user_status_changed', {userId: cleanId, online: true});

            const pendingPackets = await drainMailbox(cleanId);
            if (pendingPackets.length > 0) {
                console.log(`[Mailbox] Delivering ${pendingPackets.length} queued packets to ${cleanId}`);

                for (const queued of pendingPackets) {
                    socket.emit('receive_packet', {
                        senderId: queued.senderId,
                        senderDisplayName: queued.senderDisplayName,
                        packet: queued.packet,
                        timestamp: queued.timestamp
                    });
                }
            }
        } catch (err) {
            console.error(`[Error] register_identity database failure:`, err);
            callback({success: false, error: 'Database error during identity registration.'});
        }
    });

    socket.on('lookup_user', async (targetUserId, callback) => {
        const cleanId = targetUserId.trim().toUpperCase();
        try{
            const storedProfile = await getUser(cleanId);

            if (!storedProfile) {
                return callback({
                    success: false,
                    error: `User ID "${targetUserId}" has not registered on this relay.`
                })
            }

            callback({
                success: true,
                publicKey: storedProfile.publicKey,
                displayName: storedProfile.displayName
            });
        } catch (err) {
            console.error(`[Error] lookup_user database failure:`, err);
            callback({success: false, error: 'Database error looking up user.'});
        }
    });

    socket.on('send_packet', async ({recipientId, packet}, callback) => {
        const senderId = userIdsBySocketId.get(socket.id);
        if (!senderId) {
            return callback({
                success: false,
                error: `Unauthorized: You must register an identity before sending messages.`
            });
        }

        const senderSession = sessionsByUserId.get(senderId);
        const cleanRecipientId = recipientId.trim().toUpperCase();
        const targetSession = sessionsByUserId.get(cleanRecipientId);
        try{
            const knownRecipient = await getUser(cleanRecipientId);

            if (!knownRecipient) {
                return callback({
                    success: false,
                    error: `Recipient "${recipientId}" does not exist on this relay.`
                });
            }

            const senderDisplayName = senderSession?.displayName || 'Unknown';

            if (targetSession) {
                io.to(targetSession.socketId).emit('receive_packet', {
                    senderId,
                    senderDisplayName,
                    packet,
                    timestamp: Date.now()
                });

                console.log(
                    `[Relayed Direct] ${senderDisplayName} (${senderId}) -> ` +
                    `${targetSession.displayName} (${cleanRecipientId}) [${packet.ciphertext.length} bytes]`
                );
            } else {
                const queuedPacket: QueuedPacket = {
                    id: crypto.randomUUID(),
                    senderId,
                    senderDisplayName,
                    packet,
                    timestamp: Date.now()
                };

                await enqueuePacket(cleanRecipientId, queuedPacket);

                console.log(
                    `[Queued DB] ${senderDisplayName} (${senderId}) -> ` +
                    `${knownRecipient.displayName} (${cleanRecipientId})`
                );
            }

            callback({success: true});
        } catch (err) {
            console.error(`[Error] send_packet database failure:`, err);
            callback({success: false, error: 'Failed to deliver or queue packet.'});
        }
    });

    socket.on('disconnect', () => {
        const userId = userIdsBySocketId.get(socket.id);

        if (userId) {
            sessionsByUserId.delete(userId);
            userIdsBySocketId.delete(socket.id);

            socket.broadcast.emit('user_status_changed', { userId, online: false });

            console.log(`[Disconnect] User ID ${userId} went offline.`);
        }
    });
});

const PORT = Number(process.env.PORT) || 4000;

async function startServer() {
    try {
        await initDb();
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`Blind Relay Server listening on http://localhost:${PORT}`);
        });

    } catch (err) {
        console.log(`[Fatal] Failed to initialize database:`, err);
        process.exit(1);
    }
}

startServer();


function handleShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Closing server cleanly...`);
  io.close(async () => {
    try {
        await pool.end();
        console.log(`[Database] PostgreSQL connection pool closed.`);
    } catch (err) {
        console.log(`[Database] Error closing pool:`, err);
    }
    server.close(() => {
      console.log('Server closed. Process terminating.');
      process.exit(0);
    });
  });

  setTimeout(() => {
    process.exit(0);
  }, 1000).unref();
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));