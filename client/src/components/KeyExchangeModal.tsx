import { useState } from "react";
import { socket } from "../lib/socket";
import { isValidUserId } from "../lib/id";
import { getDb, type Contact } from "../lib/db";
import { type PeerProfile } from "../lib/types";
import xmark from "../assets/xmark.svg";

interface KeyExchangeProps {
  isOpen: boolean;
  myUserId: string | null;
  onConnectPeer: (peer: PeerProfile) => void;
  onClose?: () => void;
}

export function KeyExchangeModal({
  isOpen,
  myUserId,
  onConnectPeer,
  onClose,
}: KeyExchangeProps) {
  const [targetId, setTargetId] = useState("");
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    if (!myUserId) return;
    navigator.clipboard.writeText(myUserId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnect = () => {
    setError(null);
    const formattedId = targetId.trim().toUpperCase();

    if (!isValidUserId(formattedId)) {
      setError("Invalid ID format. Must follow XXXX-XXXX-XXXX");
      return;
    }

    setIsSubmitting(true);

    socket.emit("lookup_user", formattedId, async (res) => {
      setIsSubmitting(false);

      if (!res.success || !res.publicKey) {
        setError(res.error || "Peer not found");
        return;
      }

      const peerProfile: PeerProfile = {
        userId: formattedId,
        name: res.displayName || "Peer",
        publicKey: res.publicKey,
        online: true,
      };

      try {
        const db = await getDb();
        const contactRecord: Contact = {
          userId: peerProfile.userId,
          displayName: peerProfile.name,
          publicKey: peerProfile.publicKey,
          lastSeen: Date.now(),
        };
        await db.put("contacts", contactRecord);

        onConnectPeer(peerProfile);
      } catch (err: any) {
        setError(err.message || "Failed to save contact.");
      }
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content-wrapper">
        {onClose && (
          <button type="button" className="modal-close-icon" onClick={onClose}>
            <img src={xmark} alt="close contacts" className="icon" />
          </button>
        )}

        <div className="modal-card">
          <h3>Your Identity</h3>
          {myUserId && <h3 className="center">{myUserId}</h3>}
          <button type="button" onClick={handleCopyCode} disabled={!myUserId}>
            {copied ? "Copied!" : "Copy My Code"}
          </button>

          <h3>Connect to a User</h3>
          {error && <p className="error-text">{error}</p>}

          <input
            type="text"
            placeholder="XXXX-XXXX-XXXX"
            value={targetId}
            maxLength={14}
            onChange={(e) => setTargetId(e.target.value.toUpperCase())}
            disabled={isSubmitting}
          />
          <button
            type="button"
            onClick={handleConnect}
            disabled={isSubmitting || !targetId.trim()}
          >
            {isSubmitting ? "Looking up..." : "Connect"}
          </button>
          <p>Other user must also enter your code to view messages you send</p>
        </div>
      </div>
    </div>
  );
}
