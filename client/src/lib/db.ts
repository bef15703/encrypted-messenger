import {openDB, type DBSchema, type IDBPDatabase} from 'idb';

export interface LocalMessage {
    id: string;
    conversationId: string;
    senderId: string;
    text: string;
    timestamp: number;
    outgoing: boolean;
}

export interface Contact {
    userId: string;
    displayName: string;
    publicKey: JsonWebKey;
    lastSeen?: number;
}

export interface StoredIdentity {
    userId: string;
    displayName: string;
    keyPair: {
        publicKey: JsonWebKey;
        privateKey: JsonWebKey;
    };
}

interface MessengerDB extends DBSchema {
    identity: {
        key: string;
        value: StoredIdentity;
    };
    contacts: {
        key: string;
        value: Contact;
    };
    messages: {
        key: string;
        value: LocalMessage;
        indexes: {'by-conversation': string}
    };
}

const DB_NAME = 'blind-messenger-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<MessengerDB>> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<MessengerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('identity')) {
          db.createObjectStore('identity');
        }

        if (!db.objectStoreNames.contains('contacts')) {
          db.createObjectStore('contacts', { keyPath: 'userId' });
        }

        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
          messageStore.createIndex('by-conversation', 'conversationId');
        }
      },
    });
  }
  return dbPromise;
}