import { type EncryptedPacket } from "./crypto.js";

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

export interface ServerToClientEvents {
  receive_packet: (payload: {
    senderId: string;
    senderDisplayName: string;
    packet: EncryptedPacket;
  }) => void;

  user_status_changed: (payload: {
    userId: string;
    online: boolean;
  }) => void;
}

export interface ClientToServerEvents {
  register_identity: (
    payload: {
      userId: string;
      displayName: string;
      publicKey: JsonWebKey;
    },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;

  lookup_user: (
    targetUserId: string,
    callback: (res: {
      success: boolean;
      publicKey?: JsonWebKey;
      displayName?: string;
      error?: string;
    }) => void
  ) => void;

  send_packet: (
    payload: {
      recipientId: string;
      packet: EncryptedPacket;
    },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;
}