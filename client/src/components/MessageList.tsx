import { useEffect, useRef } from "react";
import { type ChatMessage } from "../types";

interface MessageListProps {
    messages: ChatMessage[]
}

export function MessageList({messages}: MessageListProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const isAtBottomRef = useRef<boolean>(true);

    const handleScroll = () => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const threshold = 100;
        const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        isAtBottomRef.current = distanceToBottom <= threshold;
    };

    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;

        if (isAtBottomRef.current) {
            el.scrollTo({
                top: el.scrollHeight,
                behavior: "smooth",
            });
        }
    }, [messages]);

    if (messages.length === 0) {
        return (
            <div className="empty-chat">
                <p>No messages yet.</p>
            </div>
        );
    }

    return (
        <div ref={scrollContainerRef} onScroll={handleScroll} className="message-list no-scrollbar">
            {messages.map((msg) => (
                <div key={msg.id} className={`message-bubble ${msg.sender === 'me' ? 'sent' : 'received'}`}>
                    <div className="message-content">{msg.text}</div>
                    <span className="message-time">
                        {new Date(msg.timestamp).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}).toLocaleLowerCase()}
                    </span>
                </div>
            ))}
        </div>
    );
}