export interface JsonWebKey {
  kty?: string;
  crv?: string;
  x?: string;
  y?: string;
  d?: string;
  ext?: boolean;
  key_ops?: string[];
  [key: string]: unknown;
}

export interface EncryptedPacket {
    ciphertext: number[];
    iv: number[];
    ephemeralPublicKey: JsonWebKey;
}

export interface UserSession {
    userId: string;
    displayName: string;
    socketId: string;
    publicKey: JsonWebKey
}

export interface ClientToServerEvents {
    register_identity: (
        data: {userId: string; displayName: String; publicKey: JsonWebKey},
        callback: (response: {success: boolean; error?: string}) => void
    ) => void;

    lookup_user: (
        targetUserId: string,
        callback: (response: {
            success: boolean;
            publicKey?: JsonWebKey;
            displayName?: string;
            error?: string;
        }) => void
    ) => void;

    send_packet: (
        data: {recipientId: string; packet: EncryptedPacket},
        callback: (response: {success: boolean; error?: string}) => void
    ) => void;
}

export interface ServerToClientEvents {
    receive_packet: (data: {
        senderId: string;
        senderDisplayName: string;
        packet: EncryptedPacket
    }) => void;

    user_status_changed: (data: {userId: string; online: boolean}) => void;
}