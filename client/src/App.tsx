import { useState, useEffect, useRef } from "react";
import {
  encryptMessage,
  decryptMessage,
  type EncryptedPacket,
} from "./lib/crypto";
import { type ChatMessage, type PeerProfile } from "./lib/types";
import { getDb, type LocalMessage, type Contact } from "./lib/db";
import { initOrGetIdentity, type ActiveIdentity } from "./lib/identity";
import { socket, connectWithIdentity } from "./lib/socket";
import { MessageList } from "./components/MessageList";
import { MessageInput } from "./components/MessageInput";
import { KeyExchangeModal } from "./components/KeyExchangeModal";
import "./App.css";

export default function App() {
  // Active user's identity and socket connection state
  const [identity, setIdentity] = useState<ActiveIdentity | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // Active peer session and multi-chat contact state
  const [peer, setPeer] = useState<PeerProfile | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleSelectContact = (contact: Contact) => {
    setPeer({
      userId: contact.userId,
      name: contact.displayName,
      publicKey: contact.publicKey,
      online: true,
    });
  };

  const peerRef = useRef<PeerProfile | null>(peer);
  useEffect(() => {
    peerRef.current = peer;
  }, [peer]);

  //Initializes identity from IndexedDB and connect to relay server
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const activeIdentity = await initOrGetIdentity("Brady");
        if (!isMounted) return;
        setIdentity(activeIdentity);

        // Connects socket & register identity
        const registered = await connectWithIdentity(activeIdentity);
        if (!isMounted) return;
        setIsConnected(registered);

        // Loads saved contacts from IndexedDB
        const db = await getDb();
        const savedContacts = await db.getAll("contacts");
        if (isMounted) {
          setContacts(savedContacts);
        }
      } catch (err) {
        console.error("[App] Initialization failed:", err);
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  // Loads conversation history when switching active peer
  useEffect(() => {
    if (!peer) {
      setMessages([]);
      return;
    }

    // Freeze the current peer's ID into a local constant
    const targetUserId = peer.userId;

    async function loadThread() {
      const db = await getDb();
      const localMsgs = await db.getAllFromIndex(
        "messages",
        "by-conversation",
        targetUserId,
      );

      localMsgs.sort((a, b) => a.timestamp - b.timestamp);
      const uiMessages: ChatMessage[] = localMsgs.map((m) => ({
        id: m.id,
        sender: m.outgoing ? "me" : "peer",
        text: m.text,
        timestamp: m.timestamp,
      }));

      setMessages(uiMessages);
    }

    loadThread();
  }, [peer]);

  // Listens for incoming packets over the blind relay
  useEffect(() => {
    if (!identity) return;

    const handleReceivePacket = async (data: {
      senderId: string;
      senderDisplayName: string;
      packet: EncryptedPacket;
      timestamp?: number;
    }) => {
      try {
        // Decrypts using local private key
        const plaintext = await decryptMessage(
          data.packet,
          identity.privateKey,
        );

        const newMessageId = crypto.randomUUID();
        const messageTimestamp = data.timestamp ?? Date.now();

        // Saves decrypted record to IndexedDB
        const db = await getDb();
        const localRecord: LocalMessage = {
          id: newMessageId,
          conversationId: data.senderId,
          senderId: data.senderId,
          text: plaintext,
          timestamp: messageTimestamp,
          outgoing: false,
        };
        await db.put("messages", localRecord);

        // If the sender is active open chat, display it immediately
        if (peerRef.current && peerRef.current.userId === data.senderId) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMessageId)) return prev;
            const updated = [
              ...prev,
              {
                id: newMessageId,
                sender: "peer" as const,
                text: plaintext,
                timestamp: messageTimestamp,
                rawPacket: data.packet,
              },
            ];
            return updated.sort((a, b) => a.timestamp - b.timestamp);
          });
        }
      } catch (err) {
        console.error("[App] Failed to decrypt incoming packet:", err);
      }
    };

    socket.off("receive_packet");
    socket.on("receive_packet", handleReceivePacket);

    return () => {
      socket.off("receive_packet", handleReceivePacket);
    };
  }, [identity]);

  // Encrypts, transmits, and saves outgoing message
  const handleSendMessage = async (plainText: string) => {
    if (!peer || !identity) return;

    try {
      const packet = await encryptMessage(peer.publicKey, plainText);

      const messageId = crypto.randomUUID();
      const timestamp = Date.now();

      socket.emit(
        "send_packet",
        { recipientId: peer.userId, packet },
        (res) => {
          if (!res.success) {
            console.warn("[App] Relay response warning:", res.error);
          }
        },
      );

      const db = await getDb();
      const localRecord: LocalMessage = {
        id: messageId,
        conversationId: peer.userId,
        senderId: identity.userId,
        text: plainText,
        timestamp,
        outgoing: true,
      };
      await db.put("messages", localRecord);

      const newMessage: ChatMessage = {
        id: messageId,
        sender: "me",
        text: plainText,
        timestamp,
        rawPacket: packet,
      };
      setMessages((prev) => [...prev, newMessage]);
    } catch (err) {
      console.error("[App] Encryption/transmission failed:", err);
      alert("Failed to encrypt and send message.");
    }
  };

  // Connects peer handler (saves contact to IndexedDB and opens thread)
  const handleConnectPeer = async (connectedPeer: PeerProfile) => {
    const db = await getDb();
    const contactRecord: Contact = {
      userId: connectedPeer.userId,
      displayName: connectedPeer.name,
      publicKey: connectedPeer.publicKey,
      lastSeen: Date.now(),
    };
    await db.put("contacts", contactRecord);

    setContacts((prev) => {
      if (prev.some((c) => c.userId === connectedPeer.userId)) return prev;
      return [...prev, contactRecord];
    });

    setPeer(connectedPeer);
  };

  return (
    <div className="app-layout">
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          {!isSidebarCollapsed && <h3>Chats</h3>}
          <div className="sidebar-header-actions">
            {!isSidebarCollapsed && (
              <button
                type="button"
                className="new-chat-btn"
                onClick={() => setIsModalOpen(true)}
              >
                New Chat
              </button>
            )}
            <button
              type="button"
              className="toggle-sidebar-btn"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isSidebarCollapsed ? '»' : '«'}
            </button>
          </div>
        </div>

        {!isSidebarCollapsed && (
          <div className="contact-list">
            {contacts.length === 0 ? (
              <p className="empty-contacts-text">No contacts saved yet.</p>
            ) : (
              contacts.map((contact) => (
                <button
                  key={contact.userId}
                  type="button"
                  className={`contact-item ${peer?.userId === contact.userId ? 'active' : ''}`}
                  onClick={() => handleSelectContact(contact)}
                >
                  <div className="contact-name">{contact.displayName}</div>
                  <div className="contact-id">{contact.userId}</div>
                </button>
              ))
            )}
          </div>
        )}
      </aside>

      <div className="main-column">
        <header className="app-header">
          <div>
            <h2>Encrypted Messenger</h2>
            {/*identity && (
              <small style={{ color: '#888' }}>
                Your ID: <strong>{identity.userId}</strong> ({isConnected ? '🟢 Online' : '🔴 Offline'})
              </small>
            )*/}
          </div>
          {peer && (
            <div className="active-peer-info">
              <span className="peer-badge">
                Chatting with: <strong>{peer.name}</strong> {/*({peer.userId})*/}
              </span>
            </div>
          )}
        </header>

          <section className="chat-pane">
            {peer ? (
              <div className="chat-container">
                <MessageList messages={messages} />
                <MessageInput onSendMessage={handleSendMessage} />
              </div>
            ) : (
              <div className="empty-chat-pane">
                <p>Select a conversation from the sidebar or click <strong>+ New Chat</strong> to connect with a peer.</p>
              </div>
            )}
          </section>
      </div>

      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content-wrapper">
            <button
              type="button"
              className="modal-close-icon"
              onClick={() => setIsModalOpen(false)}
            >
              &times;
            </button>
            <KeyExchangeModal
              myUserId={identity?.userId || null}
              onConnectPeer={(newPeer) => {
                handleConnectPeer(newPeer);
                setIsModalOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
