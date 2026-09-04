import { io, Socket } from 'socket.io-client';
import { type ClientToServerEvents, type ServerToClientEvents } from './types';
import { type ActiveIdentity } from './identity';

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

export const socket: TypedSocket = io(SERVER_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});

export function connectWithIdentity(identity: ActiveIdentity): Promise<boolean> {
    return new Promise((resolve) => {
        const register = () => {
            console.log(`[Socket] Conencted. Registering identity: ${identity.userId}`);

            socket.emit(
                'register_identity',
                {
                    userId: identity.userId,
                    displayName: identity.displayName,
                    publicKey: identity.publicKey
                },
                (response) => {
                    if (response.success) {
                        console.log(`[Socket] Identity registered successfully on relay.`);
                        resolve(true);
                    } else {
                        console.error(`[Socket] Identity registration failed:`, response.error);
                        resolve(false);
                    }
                }
            );
        };

        socket.off('connect');
        socket.on('connect', register)

        if (socket.connected) {
            register()
        } else {
            socket.connect();
        }
    });
}