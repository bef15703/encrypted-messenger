# Encrypted Messenger

Full stack, real-time secure messaging application with end-to-end encryption (E2EE), client side key generation, and an untrusted WebSocket relay.

**Live Demo:** [Vercel Client](https://encrypted-messenger-client.vercel.app) | **Relay:** Hosted on Railway

## Features
- **Client-Side Cryptography**: Key generation and encryption execute exclusively inside the browser via the Web Crypto API. The server never observes private keys or plaintext.
- **Asymmetric & Symmetric Hybrid Encryption**: Employs ECDH (Elliptic-Curve Diffie-Hellman) for key exchange paired with AES-GCM (256-bit) for authenticated ciphertext payload delivery.
- **Untrusted Zero-Knowledge Relay**: Backend acts strictly as an authenticated router and ciphertext queue; database compromise reveals zero message contents.
- **Offline Message Queuing**: Messages sent to disconnected contacts are encrypted client-side, staged in PostgreSQL, and flushed upon recipient reconnect.
- **Local Persistence**: Decrypted message history and cryptographic keys are isolated locally in IndexedDB.

## Architecture & Cryptographic Flow
```
[ Client A (Browser) ]
       │  1. Generates ephemeral keys via Web Crypto API
       │  2. Encrypts payload with Recipient's Public Key (AES-GCM)
       ▼
[ Railway Relay (Node.js / Socket.io) ]
       │  3. Routes raw ciphertext (Zero access to plaintext or private keys)
       ├────────────────────────┐
       ▼ (Recipient Online)     ▼ (Recipient Offline)
[ Client B (Browser) ]    [ PostgreSQL Queue ]
  4. Decrypts locally       Stored securely until 
     via Private Key        recipient reconnects
```

## Tech Stack
| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, IndexedDB (`idb`), Web Crypto API |
| **Backend** | Node.js, Express, Socket.io, TypeScript |
| **Database** | PostgreSQL (Railway managed) |
| **Deployment** | Vercel (Client CI/CD), Railway (Relay & Postgres Engine) |

## Local Deployment
### Prerequisites
- Node.js 20+
- PostgreSQL database instance

### Installation
1. Clone the repository
```
$ git clone https://github.com/bef15703/encrypted-messenger
$ cd encrypted-messenger
```

2. Install Dependencies
```
$ npm install
```

3. Configure Environment Variables
- Create `.env` in `server/`
```
PORT=4000
DATABASE_URL=postgresql://user:password@localhost:5432/messenger
CLIENT_URL=http://localhost:5173
```

- Create `.env` in `client/`
```
VITE_SERVER_URL=http://localhost:4000`
```

4. Launch Services:
```
$ npm run dev
```



