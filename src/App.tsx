import { useState, useEffect } from 'react';
import { generateIdentityKeyPair, exportPublicKey, encryptMessage, decryptMessage } from './crypto';
import { type ChatMessage, type PeerProfile } from './types';
import { MessageList } from './components/MessageList';
import { MessageInput } from './components/MessageInput';
import './App.css'

export default function App() {
  //My Identity Keys
  const [myKeys, setMyKeys] = useState<CryptoKeyPair | null>(null);
  const [myPublicJwk, setMyPublicJwk] = useState<JsonWebKey | null>(null);

  //Active session and messages
  const [peer, setPeer] = useState<PeerProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  //Initialize client idenity on load
  useEffect(() => {
    async function init() {
      const pair = await generateIdentityKeyPair();
      const jwk = await exportPublicKey(pair.publicKey);
      setMyKeys(pair);
      setMyPublicJwk(jwk);
    }
    init();
  },[]);

  //Encrypt and send handler
  const handleSendMessage = async (plainText: string) => {
    if (!peer || !myKeys) return;

    try {
      const packet = await encryptMessage(peer.publicKey, plainText);

      const newMessage: ChatMessage = {
        id: crypto.randomUUID(),
        sender: 'me',
        text: plainText,
        timestamp: Date.now(),
        rawPacket: packet,
      };

      setMessages((prev) => [...prev, newMessage]);

      console.log('Encrypted packet ready for network:', packet);
    } catch (err) {
      console.error('Encryption failed:', err);
      alert('Failed to encrypt message.')
    }
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <h2>Encrypted Messenger</h2>
        {peer && <span className="peer-badge">Chatting with: <strong>{peer.name}</strong></span>}
      </header>

      <main className="app-body">
        <div className="chat-container">
          <MessageList messages={messages} />
          <MessageInput onSendMessage={handleSendMessage} />
        </div>
      </main>
    </div>
  );
}
