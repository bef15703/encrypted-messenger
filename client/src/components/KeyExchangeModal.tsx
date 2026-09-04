import { useState } from 'react';
import { socket } from '../lib/socket';
import { isValidUserId } from '../lib/id';
import { getDb, type Contact } from '../lib/db';
import { type PeerProfile } from '../lib/types';

interface KeyExchangeProps {
    myUserId: string | null;
    onConnectPeer: (peer: PeerProfile) => void;
}

export function KeyExchangeModal({myUserId, onConnectPeer}: KeyExchangeProps) {
    const [targetId, setTargetId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCopyMyKey = () => {
        if (!myUserId) return;
        navigator.clipboard.writeText(myUserId);
        alert('Your ID copied to clipboard');
    };

    const handleConnect = () => {
        setError(null);
        const formattedId = targetId.trim().toUpperCase();

        if (!isValidUserId(formattedId)) {
            setError('Invalid ID format. Must follow XXXX-XXXX-XXXX');
            return;
        }

        setIsSubmitting(true);

        socket.emit('lookup_user', formattedId, async (res) => {
            setIsSubmitting(false);

            if (!res.success || !res.publicKey) {
                setError(res.error || 'Peer not found or offline');
                return;
            }

            const peerProfile: PeerProfile = {
                userId: formattedId,
                name: res.displayName || 'Peer',
                publicKey: res.publicKey,
                online: true
            };

            try {
                const db = await getDb();
                const contactRecord: Contact = {
                    userId: peerProfile.userId,
                    displayName: peerProfile.name,
                    publicKey: peerProfile.publicKey,
                    lastSeen: Date.now()
                };
                await db.put('contacts', contactRecord)

                onConnectPeer(peerProfile);
            } catch (err: any) {
                setError(err.message || 'Failed to save contact.');
            }
        });
    };

    return (
        <div className="key-exchange-card">
            <h3>Your Identity</h3>
            <button type="button" onClick={handleCopyMyKey} disabled={!myUserId}>
                Copy My User ID (Share this)
            </button>

            <h3>Connect to a Recipient</h3>
            {error && <p className="error-text">{error}</p>}

            <input 
                type="text"
                placeholder="XXXX-XXXX-XXXX"
                value={targetId}
                maxLength={14}
                onChange={(e) => setTargetId(e.target.value.toUpperCase())}
                disabled={isSubmitting}
            />
            <button type="button" onClick={handleConnect} disabled={isSubmitting || !targetId.trim()}>
                {isSubmitting ? 'Looking up...' : 'Connect to Peer'}
            </button>
        </div>
    );
}