import { getDb, type StoredIdentity } from './db'
import { generateUserId } from './id'
import {
    generateIdentityKeyPair,
    generateSignatureKeyPair,
    exportKeyPair,
    importPrivateKey,
    importPrivateSigningKey,
} from './crypto';

export interface ActiveIdentity {
    userId: string;
    displayName: string;
    // ECDH Key Exchange
    publicKey: JsonWebKey;
    privateKey: CryptoKey;
    // ECDSA Digital Signatures
    signingPublicKey: JsonWebKey;
    signingPrivateKey: CryptoKey;
}

export async function loadStoredIdentity(): Promise<ActiveIdentity | null> {
    const db = await getDb();
    const record = await db.get('identity', 'current_user');

    if (!record) {
        return null;
    }

    // Generate signing keys for older identities
    if(!record.signingKeyPair) {
        const signingPair = await generateSignatureKeyPair();
        const exportedSigning = await exportKeyPair(signingPair);

        record.signingKeyPair = exportedSigning

        await db.put("identity", record, "current_user");
    }

    const [privateKey, signingPrivateKey] = await Promise.all([
        importPrivateKey(record.keyPair.privateKey),
        importPrivateSigningKey(record.signingKeyPair.privateKey)
    ]);

    return {
        userId: record.userId,
        displayName: record.displayName,
        publicKey: record.keyPair.publicKey,
        privateKey,
        signingPublicKey: record.signingKeyPair.publicKey,
        signingPrivateKey: signingPrivateKey
    };
}

export async function createNewIdentity(displayName: string): Promise<ActiveIdentity> {
    const cleanName = displayName.trim() || 'Anonymous';
    const userId = generateUserId();

    const [exchangePair, signingPair] = await Promise.all([
        generateIdentityKeyPair(),
        generateSignatureKeyPair(),
    ]);

    const [exportedExchange, exportedSigning] = await Promise.all([
        exportKeyPair(exchangePair),
        exportKeyPair(signingPair),
    ]);

    const record: StoredIdentity = {
        userId,
        displayName: cleanName,
        keyPair: exportedExchange,
        signingKeyPair: exportedSigning
    };

    const db = await getDb();
    await db.put('identity', record, 'current_user');

    return {
        userId,
        displayName: cleanName,
        publicKey: exportedExchange.publicKey,
        privateKey: exchangePair.privateKey,
        signingPublicKey: exportedSigning.publicKey,
        signingPrivateKey: signingPair.privateKey,
    };
}

export async function updateDisplayName(current: ActiveIdentity, newDisplayName: string): Promise<ActiveIdentity> {
    const cleanName = newDisplayName.trim() || 'Anonymous';
    const db = await getDb();
    const existingRecord: StoredIdentity | undefined = await db.get('identity', 'current_user');

    if (!existingRecord) {
        throw new Error('Cannot update display name: No identity found.');
    }

    const updatedRecord: StoredIdentity = {
        ...existingRecord,
        displayName: cleanName
    };

    await db.put('identity', updatedRecord, 'current_user');

    return {
        ...current,
        displayName: cleanName
    };
}

export async function initOrGetIdentity(defaultName: string = 'User'): Promise<ActiveIdentity> {
    const existing = await loadStoredIdentity();
    if (existing) {
        return existing;
    }
    return await createNewIdentity(defaultName);
}