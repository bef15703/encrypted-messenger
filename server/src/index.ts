import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import {
    ClientToServerEvents,
    ServerToClientEvents,
    UserSession,
} from './types.js'
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

        console.log(`[Registered] "${cleanName}" (${cleanId}) mapped to socket ${socket.id}`);

        callback({success: true});

        socket.broadcast.emit('user_status_changed', {userId: cleanId, online: true});
    });

    socket.on('lookup_user', (targetUserId, callback) => {
        const cleanId = targetUserId.trim().toUpperCase();
        const targetSession = sessionsByUserId.get(cleanId);

        if (!targetSession) {
            return callback({
                success: false,
                error: `User ID "${targetUserId}" not found or currently offline.`
            });
        }

        callback({
            success: true,
            publicKey: targetSession.publicKey,
            displayName: targetSession.displayName
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
        const targetSession = sessionsByUserId.get(recipientId.trim().toUpperCase());

        if (!targetSession || !senderSession) {
            return callback({
                success: false,
                error: `Recipient "${recipientId}" is offline or does not exist.`
            });
        }

        io.to(targetSession.socketId).emit('receive_packet', {
            senderId: senderSession.userId,
            senderDisplayName: senderSession.displayName,
            packet
        });

        console.log(
            `[Relayed] ${senderSession.displayName} (${senderSession.userId}) -> ` +
            `${targetSession.displayName} (${targetSession.userId}) [${packet.ciphertext.length} bytes]`
        );

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