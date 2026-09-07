import { useState, type SubmitEvent, type KeyboardEvent  } from "react";

interface MessageInputProps {
    onSendMessage: (text: string) => void;
    disabled?: boolean;
}

export function MessageInput({onSendMessage, disabled}: MessageInputProps) {
    const [text, setText] = useState('');

    const submitCurrentMessage = () => {
        const trimmed = text.trim()
        if (!trimmed || disabled) return;
        onSendMessage(trimmed);
        setText(""); //Clear input after send
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitCurrentMessage();
        }
    };

    const handleSubmit = (e: SubmitEvent) => {
        e.preventDefault(); //Prevents browser reload
        submitCurrentMessage();
    };

    return (
        <form onSubmit={handleSubmit} className="chat-input-form">
            <textarea
                placeholder={disabled? "Connect to a peer to chat..." : "Type an encrypted message..."}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={disabled}
            />
            <button type="submit" disabled={disabled || !text.trim()}>
                Send
            </button>
        </form>
    );
}