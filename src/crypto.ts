export interface EncryptedPacket {
    ciphertext: number[];
    iv: number[]; //initialization vector
    ephemeralPublicKey: JsonWebKey;
}

// Generates a long-term ECDH key pair
export async function generateIdentityKeyPair(): Promise<CryptoKeyPair> {
    return await window.crypto.subtle.generateKey(
        {
            name: 'ECDH',
            namedCurve: 'P-256' // NIST  elliptic curve
        }, //algorithm
        true, // extractable
        ['deriveKey', 'deriveBits'] //keyUsages
    );
}

// Exports public key into portable JSON Web Key
export async function exportPublicKey(key: CryptoKey): Promise<JsonWebKey> {
    return await window.crypto.subtle.exportKey('jwk', key);
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
        ['deriveKey'] //keyUsages
    );

    const sharedKey = await window.crypto.subtle.deriveKey(
        {name: 'ECDH', public: recipientKey},
        ephemeralPair.privateKey, // baseKey
        {name: 'AES_GCM', length: 256}, //derivedKeyType
        false,
        ['encrypt']
    );

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
        {name: 'AES_GCM', length: 256}, //alorithms
        false, //extractable
        [] //readonlyArray
    )

    // Derives identical shared secret AES key
    const sharedKey = await window.crypto.subtle.deriveKey(
        {name: 'ECDH', public: ephemeralKey}, //algorithm
        recipientPrivateKey, //baseKey
        {name: 'AES-GCM', length: 256}, //derivedKeyType
        false, //extractable
        ['decrypt']
    )

    // Decrypts ciphertext buffer
    const decryptBuffer = await window.crypto.subtle.decrypt(
        {name: 'AES-GCM', iv: new Uint8Array(packet.iv)}, //algorithm
        sharedKey, //key
        new Uint8Array(packet.ciphertext) //data
    );

    return new TextDecoder().decode(decryptBuffer);
}


    