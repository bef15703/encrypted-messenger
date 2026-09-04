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
import { type StoredUser, type QueuedPacket } from './types.js';
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
const userDirectory = new Map<string, StoredUser>();
const mailboxQueue = new Map<string, QueuedPacket[]>();

io.on('connection', (socket) => {
    console.log(`[Connect] Socket ID: ${socket.id}`);

    socket.on('register_identity', ({userId, displayName, publicKey}, callback) => {
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

        userDirectory.set(cleanId, {
            userId: cleanId,
            displayName: cleanName,
            publicKey,
            lastSeen: Date.now()
        });

        console.log(`[Registered] "${cleanName}" (${cleanId}) mapped to socket ${socket.id}`);

        callback({success: true});

        socket.broadcast.emit('user_status_changed', {userId: cleanId, online: true});

        const pendingPackets = mailboxQueue.get(cleanId);
        if (pendingPackets && pendingPackets.length > 0) {
            console.log(`[Mailbox] Delivering ${pendingPackets.length} queued packets to ${cleanId}`);

            for (const queued of pendingPackets) {
                socket.emit('receive_packet', {
                    senderId: queued.senderId,
                    senderDisplayName: queued.senderDisplayName,
                    packet: queued.packet,
                    timestamp: queued.timestamp
                });
            }

            mailboxQueue.delete(cleanId); // upholds zero-knowledge forward secrecy
        }
    });

    socket.on('lookup_user', (targetUserId, callback) => {
        const cleanId = targetUserId.trim().toUpperCase();
        const storedProfile = userDirectory.get(cleanId);

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
    });

    socket.on('send_packet', ({recipientId, packet}, callback) => {
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
        const knownRecipient = userDirectory.get(cleanRecipientId);

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

            const existingQueue = mailboxQueue.get(cleanRecipientId) || [];
            existingQueue.push(queuedPacket);
            mailboxQueue.set(cleanRecipientId, existingQueue);

            console.log(
                `[Queued Offline] ${senderDisplayName} (${senderId}) -> ` +
                `${knownRecipient.displayName} (${cleanRecipientId}) (Queue depth: ${existingQueue.length})`
            );
        }

        callback({success: true});
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

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Blind Relay Server listening on http://localhost:${PORT}`);
})

function handleShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Closing server cleanly...`);
  io.close(() => {
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