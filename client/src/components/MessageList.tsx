import { Fragment, useEffect, useRef } from "react";
import { type ChatMessage } from "../lib/types";
import { formatChatDividerDate, formatTime } from "../lib/utils";

interface MessageListProps {
  messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
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
      {messages.map((msg, index) => {
        const currentDate = new Date(msg.timestamp).toDateString();
        const prevDate =
          index > 0
            ? new Date(messages[index - 1].timestamp).toDateString()
            : null;
        const showDateDivider = currentDate !== prevDate;

        return (
          <Fragment key={msg.id}>
            {showDateDivider && (
              <div className="date-divider">
                <span>{formatChatDividerDate(msg.timestamp)}</span>
              </div>
            )}
            <div className={`message-bubble ${msg.sender === "me" ? "sent" : "received"}`}>
              <div className="message-content">{msg.text}</div>
              <span className="message-time">
                {formatTime(msg.timestamp)}
              </span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
