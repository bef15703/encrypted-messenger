import { useState, type SubmitEvent  } from "react";

interface MessageInputProps {
    onSendMessage: (text: string) => void;
    disabled?: boolean;
}

export function MessageInput({onSendMessage, disabled}: MessageInputProps) {
    const [text, setText] = useState('');

    const handleSubmit = (e: SubmitEvent) => {
        e.preventDefault(); //Prevents browser reload
        if (!text.trim() || disabled) return;

        onSendMessage(text);
        setText(''); //Clear input after send
    };

    return (
        <form onSubmit={handleSubmit} className="chat-input-form">
            <textarea
                placeholder={disabled? "Connect to a peer to chat..." : "Type an encrypted message..."}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={disabled}
            />
            <button type="submit" disabled={disabled || !text.trim()}>
                Send
            </button>
        </form>
    );
}