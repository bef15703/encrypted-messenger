import { useState } from 'react'
import { type PeerProfile } from '../types'

interface KeyExchangeProps {
    myPublicJwk: JsonWebKey | null;
    onConnectPeer: (peer: PeerProfile) => void;
}

export function KeyExchangeModal({myPublicJwk, onConnectPeer}: KeyExchangeProps) {
    const [peerName, setPeerName] = useState('');
    const [peerKeyInput, setPeerKeyInput] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleCopyMyKey = () => {
        if (!myPublicJwk) return;
        navigator.clipboard.writeText(JSON.stringify(myPublicJwk));
        alert('Public key copied to clipboard');
    };

    const handleConnect = () => {
        setError(null);
        try {
            const parsed = JSON.parse(peerKeyInput);
            if (!parsed.x || !parsed.y || parsed.crv !== 'P-256') {
                throw new Error('Invalid P-256 Elliptical Curve JWK format')
            }

            onConnectPeer({
                name: peerName.trim() || 'Peer',
                publicKey: parsed,
            });
        } catch (err: any){
            setError(err.message || 'Failed to parse JSON Web Key');
        }
    };

    return (
        <div className="key-exchange-card">
            <h3>Your Identity</h3>
            <button type="button" onClick={handleCopyMyKey} disabled={!myPublicJwk}>
                Copy My Public Key (Share this)
            </button>

            <h3>Connect to a Recipient</h3>
            {error && <p className="error-text">{error}</p>}

            <input 
                type="text"
                placeholder="Recipient Name"
                value={peerName}
                onChange={(e) => setPeerName(e.target.value)}
            />
            <textarea
                placeholder="Recipient Public Key"
                value={peerKeyInput}
                onChange={(e) => setPeerKeyInput(e.target.value)}
                rows={4}
            /><button type="button" onClick={handleConnect} disabled={!peerKeyInput.trim()}>
                Start Encrypted Session
            </button>
        </div>
    );
}