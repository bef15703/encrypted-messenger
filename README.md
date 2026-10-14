# Encrypted Messenger

Full stack, real-time secure messaging application with end-to-end encryption (E2EE), client side key generation, and an untrusted WebSocket relay.

**Live Demo:** [Vercel Client](https://encrypted-messenger-client.vercel.app) | **Relay:** Hosted on Railway

## Contents
- [Features](#features)
- [Architecture & Cryptographic Flow](#architecture--cryptographic-flow)
- [Security Specifications](#security-specifications)
- [Tech Stack](#tech-stack)
- [Local Deployment](#local-deployment)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Directory Layout](#directory-layout)

## Features
- **Client-Side Cryptography**: Key generation and encryption execute exclusively inside the browser via the Web Crypto API. The server never observes private keys or plaintext.
- **Asymmetric & Symmetric Hybrid Encryption**: Employs ECDH (Elliptic-Curve Diffie-Hellman) for key exchange paired with AES-GCM (256-bit) for authenticated ciphertext payload delivery.
- **Dual-Key Identity Architecture**: Enforces strict separation of concerns using distinct key pairs per identity: ECDH P-256 for key agreement and ECDSA P-256 for digital signatures.
- **Encrypt-then-Sign Authenticity**: Outgoing packets are signed over the composite ciphertext, IV, ephemeral public key, and canonical metadata to ensure packet author authenticity.
- **Tamper-Evident Transport (AAD)**: Message metadata is bound directly into the AES-GCM authentication tag.
- **Untrusted Zero-Knowledge Relay**: Backend acts strictly as an authenticated router and ciphertext queue; database compromise reveals zero message contents.
- **Offline Message Queuing**: Messages sent to disconnected contacts are encrypted client-side, staged in PostgreSQL, and flushed upon recipient reconnect.
- **Local Persistence**: Decrypted message history and cryptographic keys are isolated locally in IndexedDB.

## Architecture & Cryptographic Flow
```
[ Client A (Browser) ]
       │  1. Generates ephemeral keys via Web Crypto API
       │  2. Derives symmetric key via ECDH + Recipient Public Key
       │  3. Encrypts payload with AES-GCM, binding canonical AAD
       │     metadata
       │  4. Signs packet data with sender ECDSA Private Key
       ▼
[ Railway Relay (Node.js / Socket.io) ]
       │  5. Routes raw packet 
       │     (Zero access to plaintext or private keys)
       ├────────────────────────┐
       ▼ (Recipient Online)     ▼ (Recipient Offline)
[ Client B (Browser) ]    [ PostgreSQL Queue ]
  6. Verifies ECDSA         Stored securely until 
     signature over         recipient reconnects
     packet
  7. Derives shared secret
  8. Decrypts AES-GCM and
     verifies AAD tag
```

## Security Specifications
- **NIST FIPS 186-5 (Digital Signature Standard)**: [ECDSA](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.186-5.pdf#page=29) with curve `P-256` and `SHA-256` for author authenticity.
- **NIST SP 800-38D**: [Section 5.2.1](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf#page=16) - Galois/Counter Mode (AES-GCM 256-bit) with Additional Authenticated Data (AAD) for payload confidentiality and metadata integrity.
- **[RFC 5869 (HKDF)](https://www.rfc-editor.org/info/rfc5869/)**: HMAC-based Extract-and-Expand Key Derivation Function (SHA-256) to derive symmetric encryption keys from ECDH shared secrets.


## Tech Stack
| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, IndexedDB (`idb`), Web Crypto API |
| **Backend** | Node.js, Express, Socket.io, TypeScript |
| **Database** | PostgreSQL (Railway managed) |
| **Testing** | Vitest (Automated cryptographic invariant suites) |
| **Deployment** | Vercel (Client CI/CD), Railway (Relay & Postgres Engine) |

## Local Deployment
### Prerequisites
- Node.js 20+
- PostgreSQL database instance

### Installation
1. Clone the repository
```bash
$ git clone https://github.com/bef15703/encrypted-messenger
$ cd encrypted-messenger
```

2. Install Dependencies
```bash
$ npm install
```

3. Configure Environment Variables
- Create `.env` in `server/`
```properties
PORT=4000
DATABASE_URL=postgresql://user:password@localhost:5432/messenger
CLIENT_URL=http://localhost:5173
```

- Create `.env` in `client/`
```properties
VITE_SERVER_URL=http://localhost:4000
```

4. Run Cryptographic Invariant Tests
```bash
$ npm run test
```

5. Launch Services
```bash
$ npm run dev
```

## Directory Layout

```text
.
├── client
│   ├── src
│   │   ├── components
│   │   │   ├── KeyExchangeModal.tsx
│   │   │   ├── MessageInput.tsx
│   │   │   ├── MessageList.tsx
│   │   │   └── ProfileModal.tsx
│   │   ├── lib
│   │   │   ├── crypto.ts
│   │   │   ├── db.ts
│   │   │   ├── id.ts
│   │   │   ├── identity.ts
│   │   │   ├── socket.ts    
│   │   │   ├── types.ts
│   │   │   └── utils.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── tests
│   │   └── crypto.spec.ts
│   └── package.json
├── server
│   ├── src
│   │   ├── db.ts
│   │   ├── index.ts
│   │   └── types.ts
│   └── package.json
├── package.json
└── README.md
```



