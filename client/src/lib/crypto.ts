export interface EncryptedPacket {
    ciphertext: number[];
    iv: number[]; //initialization vector
    ephemeralPublicKey: JsonWebKey;
}

export interface ExportedKeyPair {
    publicKey: JsonWebKey;
    privateKey: JsonWebKey;
}

export interface PacketMetadata {
    senderId: string;
    recipientId: string;
    timestamp: number
}

// Serializes metadata into a deterministic UTF-8 byte sequence, enforcing canonical ordering: senderId:recipientId:timestamp
export function serializeAad(metadata: PacketMetadata): Uint8Array<ArrayBuffer> {
    const canonicalString = `${metadata.senderId}:${metadata.recipientId}:${metadata.timestamp}`;
    return new TextEncoder().encode(canonicalString) as Uint8Array<ArrayBuffer>;
}

// Generates a long-term ECDH key pair
export async function generateIdentityKeyPair(): Promise<CryptoKeyPair> {
    return await globalThis.crypto.subtle.generateKey(
        {
            name: 'ECDH',
            namedCurve: 'P-256' // NIST  elliptic curve
        }, //algorithm
        true, // extractable
        ['deriveBits'] //keyUsages
    );
}

export async function exportKeyPair(keyPair: CryptoKeyPair): Promise<ExportedKeyPair> {
    const [publicKey, privateKey] = await Promise.all([
        globalThis.crypto.subtle.exportKey('jwk', keyPair.publicKey),
        globalThis.crypto.subtle.exportKey('jwk', keyPair.privateKey)
    ]);
    return {publicKey, privateKey};
}

export async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
    return await globalThis.crypto.subtle.importKey(
        'jwk',
        jwk,
        {name: 'ECDH', namedCurve: 'P-256'},
        false,
        ['deriveBits']
    );
}

const HKDF_INFO = new TextEncoder().encode("encrypted-messenger-v1-aes-gcm")
const HKDF_SALT = new Uint8Array();

async function deriveAesKeyFromEcdh(
    privateKey: CryptoKey,
    publicKey: CryptoKey,
    usage: "encrypt" | "decrypt"
): Promise<CryptoKey> {
    // Calculates raw Diffie-Hellman shared secret
    const sharedBits = await globalThis.crypto.subtle.deriveBits(
        { name: "ECDH", public: publicKey},
        privateKey,
        256
    );

    // Imports raw bits for HKDF
    const hkdfKey = await globalThis.crypto.subtle.importKey(
        "raw",
        sharedBits,
        { name: "HKDF" },
        false,
        ["deriveKey"]
    );

    return await globalThis.crypto.subtle.deriveKey(
        {
            name: "HKDF",
            hash: "SHA-256",
            salt: HKDF_SALT,
            info: HKDF_INFO,
        }, // Derive Key - HKDF params
        hkdfKey, // baseKey
        { name: "AES-GCM", length: 256 }, // derivedKeyType
        false, // extractable
        [usage] //keyUsages
    );
}


// Encrypts a message
export async function encryptMessage(
    recipientPublicJwk: JsonWebKey,
    plaintext: string,
    metadata: PacketMetadata
): Promise<EncryptedPacket> {
    const recipientKey = await globalThis.crypto.subtle.importKey(
        'jwk', //format
        recipientPublicJwk, //keyData
        { name: 'ECDH', namedCurve: 'P-256' }, //algorithm
        false, //extractable
        [] //keyUsages
    );

    const ephemeralPair = await globalThis.crypto.subtle.generateKey(
        {name: 'ECDH', namedCurve: 'P-256' }, //algorithm
        true, //extractable,
        ['deriveBits'] //keyUsages
    );

    // Shared AES-GCM key is derived using HKDF 
    const sharedKey = await deriveAesKeyFromEcdh(
        ephemeralPair.privateKey, // privateKey
        recipientKey, // publicKey
        "encrypt" // usage
    )

    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12)); // Random 12-byte initialization vector
    const encodedPlaintext = new TextEncoder().encode(plaintext); // message as raw byte buffer
    const additionalData = serializeAad(metadata);

    // Encrypts message with shared key, binds AAD
    const encryptedBuffer = await globalThis.crypto.subtle.encrypt(
        {name: 'AES-GCM', iv, additionalData}, //algorithm
        sharedKey, //key
        encodedPlaintext //data
    );

    // Exports public key for recipient to read
    const ephemeralPublicJwk = await globalThis.crypto.subtle.exportKey(
        'jwk',
        ephemeralPair.publicKey
    );

    return {
        ciphertext: Array.from(new Uint8Array(encryptedBuffer)),
        iv: Array.from(iv),
        ephemeralPublicKey: ephemeralPublicJwk
    };
}

// Decrypt message
export async function decryptMessage(
    packet: EncryptedPacket,
    recipientPrivateKey: CryptoKey,
    metadata: PacketMetadata
): Promise<string> {
    // Imports sender's one-time public key
    const ephemeralKey = await  globalThis.crypto.subtle.importKey(
        'jwk', // format
        packet.ephemeralPublicKey, //keyData
        {name: 'ECDH', namedCurve:'P-256'}, //algorithms
        false, //extractable
        [] //readonlyArray
    );

    // Shared AES-GCM key is derived using HKDF 
    const sharedKey = await deriveAesKeyFromEcdh(
        recipientPrivateKey, // privateKey
        ephemeralKey, // publicKey
        "decrypt" // usage
    );

    const additionalData = serializeAad(metadata);

    // Decrypts ciphertext buffer
    const decryptBuffer = await globalThis.crypto.subtle.decrypt(
        {name: 'AES-GCM', iv: new Uint8Array(packet.iv), additionalData}, //algorithm
        sharedKey, //key
        new Uint8Array(packet.ciphertext) //data
    );

    return new TextDecoder().decode(decryptBuffer);
}


    