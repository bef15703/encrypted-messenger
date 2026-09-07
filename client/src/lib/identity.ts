import { getDb, type StoredIdentity } from './db'
import { generateUserId } from './id'
import {
    generateIdentityKeyPair,
    exportKeyPair,
    importPrivateKey
} from './crypto'

export interface ActiveIdentity {
    userId: string;
    displayName: string;
    publicKey: JsonWebKey;
    privateKey: CryptoKey
}

export async function loadStoredIdentity(): Promise<ActiveIdentity | null> {
    const db = await getDb();
    const record = await db.get('identity', 'current_user');

    if (!record) {
        return null;
    }

    const privateKey = await importPrivateKey(record.keyPair.privateKey);

    return {
        userId: record.userId,
        displayName: record.displayName,
        publicKey: record.keyPair.publicKey,
        privateKey
    };
}

export async function createNewIdentity(displayName: string): Promise<ActiveIdentity> {
    const cleanName = displayName.trim() || 'Anonymous';
    const userId = generateUserId();

    const keyPair = await generateIdentityKeyPair();

    const exported = await exportKeyPair(keyPair);

    const record: StoredIdentity = {
        userId,
        displayName: cleanName,
        keyPair: exported
    };

    const db = await getDb();
    await db.put('identity', record, 'current_user');

    return {
        userId,
        displayName: cleanName,
        publicKey: exported.publicKey,
        privateKey: keyPair.privateKey
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