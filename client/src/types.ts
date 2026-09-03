import { type EncryptedPacket } from "./crypto";

export interface ChatMessage {
    id: string;
    sender: 'me' | 'peer';
    text: string;
    timestamp: number;
    rawPacket?: EncryptedPacket
}

export interface PeerProfile {
    name: string;
    publicKey: JsonWebKey
}