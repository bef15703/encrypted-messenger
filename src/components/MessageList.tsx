import { type ChatMessage } from "../types";

interface MessageListProps {
    messages: ChatMessage[]
}

export function MessageList({messages}: MessageListProps) {
    if (messages.length === 0) {
        return (
            <div className="empty-chat">
                <p>No messages yet.</p>
            </div>
        );
    }

    return (
        <div className="message-list">
            {messages.map((msg) => (
                <div key={msg.id} className={`message-bubble ${msg.sender === 'me' ? 'sent' : 'received'}`}>
                    <div className="message-content">{msg.text}</div>
                    <span className="message-time">
                        {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                    </span>
                </div>
            ))}
        </div>
    );
}