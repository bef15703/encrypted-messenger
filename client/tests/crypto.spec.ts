import { describe, it, expect} from 'vitest';
import {
    generateIdentityKeyPair,
    generateSignatureKeyPair,
    exportKeyPair,
    encryptMessage,
    decryptMessage,
    serializeAad,
    signPacket,
    verifyPacket,
    type PacketMetadata,
    type EncryptedPacket
} from '../src/lib/crypto';

describe("Web Crypto AEAD Engine (NIST SP 800-38D)", () => {
    it("Serializes AAD deterministically into canonical order", () => {
        const metadata: PacketMetadata = {
            senderId: 'ALICE',
            recipientId: 'BOB',
            timestamp: 1767279630,
        };
        const bytes = serializeAad(metadata);
        expect(new TextDecoder().decode(bytes)).toBe('ALICE:BOB:1767279630');
    });

    it("Decrypts successfully when ciphertext and metadata match", async () => {
        const alice = await generateIdentityKeyPair();
        const bob = await generateIdentityKeyPair();
        const bobExported = await exportKeyPair(bob);

        const metadata: PacketMetadata = {
            senderId: 'ALICE-01',
            recipientId: 'BOB-02',
            timestamp: 1767279630,
        };
        
        const plaintext = "Secret Message";
        const packet = await encryptMessage(bobExported.publicKey, plaintext, metadata);
        const decrypted = await decryptMessage(packet, bob.privateKey, metadata);

        expect(decrypted).toBe(plaintext)
    });

    it("Rejects decryption if timestamp is tampered with", async () => {
        const bob = await generateIdentityKeyPair();
        const bobExported = await exportKeyPair(bob);

        const metadata: PacketMetadata = {
            senderId: "ALICE-01",
            recipientId: "BOB-02",
            timestamp: 1767279630,
        };

        const packet = await encryptMessage(bobExported.publicKey, "Secret Message", metadata);

        const tamperedMetadata: PacketMetadata = {
            ...metadata,
            timestamp: 1767279640,
        };

        await expect(
            decryptMessage(packet, bob.privateKey, tamperedMetadata)
        ).rejects.toThrow();
    });

    it("Rejects decryption if sender identity is tampered with after send", async () => {
        const bob = await generateIdentityKeyPair();
        const bobExported = await exportKeyPair(bob);

        const metadata: PacketMetadata = {
            senderId: "ALICE-01",
            recipientId: "BOB-02",
            timestamp: 1767279630,
        };

        const packet = await encryptMessage(bobExported.publicKey, "Secret Message", metadata);

        const spoofedMeta: PacketMetadata = {
            ...metadata,
            senderId: "CHARLIE-03",
        };

        await expect(
            decryptMessage(packet, bob.privateKey, spoofedMeta)
        ).rejects.toThrow();
    });
});

describe("Web Crypto ECDSA Signature Engine (NIST FIPS 186-5", () => {
     it("Signs an encrypted packet and verifies successfully with author's public key", async () => {
        const aliceSigning = await generateSignatureKeyPair();
        const bob = await generateIdentityKeyPair();
        const bobExported = await exportKeyPair(bob);
        const metadata: PacketMetadata = {
            senderId: "ALICE-01",
            recipientId: "BOB-02",
            timestamp: 1767279630,
        };

        const packet = await encryptMessage(bobExported.publicKey, "Secret Message", metadata);
        const signature = await signPacket(
            aliceSigning.privateKey,
            packet.ephemeralPublicKey,
            packet.iv,
            packet.ciphertext,
            metadata
        );

        const signedPacket: EncryptedPacket = {
            ...packet,
            signature
        };

        const isValid = await verifyPacket(aliceSigning.publicKey, signedPacket, metadata);
        expect(isValid).toBe(true);

     });

     it("Rejects verification if ciphertext is altered after signing", async () => {
        const aliceSigning = await generateSignatureKeyPair();
        const bob = await generateIdentityKeyPair();
        const bobExported = await exportKeyPair(bob);

        const metadata: PacketMetadata = {
            senderId: "ALICE-01",
            recipientId: "BOB-02",
            timestamp: 1767279630,
        };

        const packet = await encryptMessage(bobExported.publicKey, "Secret Message", metadata);
        const signature = await signPacket(
            aliceSigning.privateKey,
            packet.ephemeralPublicKey,
            packet.iv,
            packet.ciphertext,
            metadata
        );

        const tamperedCiphertext = [...packet.ciphertext];
        tamperedCiphertext[0] ^= 0xff; // Bit-flip first byte of ciphertext

        const tamperedPacket: EncryptedPacket = {
            ...packet,
            ciphertext: tamperedCiphertext,
            signature
        };

        const isValid = await verifyPacket(aliceSigning.publicKey, tamperedPacket, metadata);
        expect(isValid).toBe(false)
     });

     it("Rejects verification if AAD metadata is altered after signing", async () => {
        const aliceSigning = await generateSignatureKeyPair();
        const bob = await generateIdentityKeyPair();
        const bobExported = await exportKeyPair(bob);

        const metadata: PacketMetadata = {
            senderId: "ALICE-01",
            recipientId: "BOB-02",
            timestamp: 1767279630,
        };

        const packet = await encryptMessage(bobExported.publicKey, "Secret Message", metadata);
        const signature = await signPacket(
            aliceSigning.privateKey,
            packet.ephemeralPublicKey,
            packet.iv,
            packet.ciphertext,
            metadata
        );

        const signedPacket: EncryptedPacket = {
            ...packet,
            signature
        };

        const tamperedMetadata: PacketMetadata = {
            ...metadata,
            senderId: "CHARLIE-03" // spoof sender
        };

        const isValid = await verifyPacket(aliceSigning.publicKey, signedPacket, tamperedMetadata);
        expect(isValid).toBe(false);
     });

     it("Rejects verification when checked against unassociated public key", async () => {
        const aliceSigning = await generateSignatureKeyPair();
        const charlieSigning = await generateSignatureKeyPair();
        const bob = await generateIdentityKeyPair();
        const bobExported = await exportKeyPair(bob);

        const metadata: PacketMetadata = {
            senderId: "ALICE-01",
            recipientId: "BOB-02",
            timestamp: 1767279630,
        };

        const packet = await encryptMessage(bobExported.publicKey, "Secret Message", metadata);
        const signature = await signPacket(
            aliceSigning.privateKey,
            packet.ephemeralPublicKey,
            packet.iv,
            packet.ciphertext,
            metadata
        );

        const signedPacket: EncryptedPacket = {
            ...packet,
            signature
        };
        
        const isValid = await verifyPacket(charlieSigning.publicKey, signedPacket, metadata);
        expect(isValid).toBe(false);
     });
});