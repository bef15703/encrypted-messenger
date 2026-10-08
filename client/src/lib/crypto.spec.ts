import { describe, it, expect} from 'vitest';
import {
    generateIdentityKeyPair,
    exportKeyPair,
    encryptMessage,
    decryptMessage,
    serializeAad,
    type PacketMetadata
} from './crypto';

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