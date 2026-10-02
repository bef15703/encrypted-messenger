export interface EncryptedPacket {
    ciphertext: number[];
    iv: number[]; //initialization vector
    ephemeralPublicKey: JsonWebKey;
}

export interface ExportedKeyPair {
    publicKey: JsonWebKey;
    privateKey: JsonWebKey;
}

// Generates a long-term ECDH key pair
export async function generateIdentityKeyPair(): Promise<CryptoKeyPair> {
    return await window.crypto.subtle.generateKey(
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
        window.crypto.subtle.exportKey('jwk', keyPair.publicKey),
        window.crypto.subtle.exportKey('jwk', keyPair.privateKey)
    ]);
    return {publicKey, privateKey};
}

export async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
    return await window.crypto.subtle.importKey(
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
    const sharedBits = await window.crypto.subtle.deriveBits(
        { name: "ECDH", public: publicKey},
        privateKey,
        256
    );

    // Imports raw bits for HKDF
    const hkdfKey = await window.crypto.subtle.importKey(
        "raw",
        sharedBits,
        { name: "HKDF" },
        false,
        ["deriveKey"]
    );

    return await window.crypto.subtle.deriveKey(
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
    plaintext: string
): Promise<EncryptedPacket> {
    const recipientKey = await window.crypto.subtle.importKey(
        'jwk', //format
        recipientPublicJwk, //keyData
        { name: 'ECDH', namedCurve: 'P-256' }, //algorithm
        false, //extractable
        [] //keyUsages
    );

    const ephemeralPair = await window.crypto.subtle.generateKey(
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

    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Random 12-byte initialization vector

    const encodedPlaintext = new TextEncoder().encode(plaintext); // message as raw byte buffer

    // Encrypts message with shared key
    const encryptedBuffer = await window.crypto.subtle.encrypt(
        {name: 'AES-GCM', iv}, //algorithm
        sharedKey, //key
        encodedPlaintext //data
    );

    // Exports public key for recipient to read
    const ephemeralPublicJwk = await window.crypto.subtle.exportKey(
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
    recipientPrivateKey: CryptoKey
): Promise<string> {
    // Imports sender's one-time public key
    const ephemeralKey = await  window.crypto.subtle.importKey(
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
    )

    // Decrypts ciphertext buffer
    const decryptBuffer = await window.crypto.subtle.decrypt(
        {name: 'AES-GCM', iv: new Uint8Array(packet.iv)}, //algorithm
        sharedKey, //key
        new Uint8Array(packet.ciphertext) //data
    );

    return new TextDecoder().decode(decryptBuffer);
}


    