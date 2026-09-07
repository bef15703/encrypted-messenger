import { useState, useEffect} from "react";
import { type ActiveIdentity } from "../lib/identity";
import xmark from "../assets/xmark.svg";

interface ProfileModalProps {
  isOpen: boolean;
  identity: ActiveIdentity | null;
  isFirstRun: boolean;
  onSave: (displayName: string) => Promise<void>;
  onClose?: () => void;
}

export function ProfileModal({
  isOpen,
  identity,
  isFirstRun,
  onSave,
  onClose,
}: ProfileModalProps) {
  const [name, setName] = useState(identity?.displayName || "");
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(identity?.displayName || "");
    }
  }, [isOpen, identity]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSave(name.trim());
      if (onClose) onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = async () => {
    if (!identity?.userId) return;
    await navigator.clipboard.writeText(identity.userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content-wrapper">
        {!isFirstRun && onClose && (
          <button
            type="button"
            className="modal-close-icon"
            onClick={onClose}
            aria-label="Close"
          >
            <img src={xmark} alt="close" className="icon" />
          </button>
        )}
        <h3>
          {isFirstRun ? "Welcome to Encrypted Messenger" : "Your Identity"}
        </h3>

        {identity && !isFirstRun && (
          <div className="modal-card">
            <h3 className="center">{identity.displayName}</h3>
            <h3 className="center">{identity.userId}</h3>
            <button type="button" onClick={handleCopyCode}>
              {copied ? "Copied!" : "Copy My Code"}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-card">
          <h3>Display Name</h3>
          <input
            id="displayName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Display Name"
            maxLength={32}
            autoFocus
            required
          />

          <button
            type="submit"
            className="primary-action-btn"
            disabled={!name.trim() || isSubmitting}
          >
            {isSubmitting
              ? "Saving..."
              : isFirstRun
                ? "Generate Identity & Start"
                : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
