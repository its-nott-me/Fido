import React, { useState, useEffect, useRef } from 'react';
import './Chat.css';
import { useAuth } from '../context/AuthContext';

interface Message {
    peerId: string;
    username: string;
    text: string;
    profileImageUrl?: string | null;
    timestamp: number;
}

interface ChatProps {
    ws: WebSocket | null;
    messages: Message[];
    onSendMessage: (text: string) => void;
    onClose: () => void;
}

export default function Chat({ messages, onSendMessage, onClose }: Omit<ChatProps, 'ws'>) {
    const { user } = useAuth();
    const [inputText, setInputText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputText.trim()) {
            onSendMessage(inputText);
            setInputText('');
        }
    };

    return (
        <div className="chat-container glass-module">
            <div className="chat-header">
                <h3>CHAT </h3>
                <button className="chat-close-btn" onClick={onClose}>×</button>
            </div>
            <div className="chat-messages">
                {messages.map((msg, index) => (
                    <div key={index} className={`message-bubble ${msg.username === user?.username ? 'self' : 'peer'}`}>
                        <div className="message-content-wrapper">
                            {msg.profileImageUrl ? (
                                <img src={msg.profileImageUrl} alt="" className="message-avatar" />
                            ) : (
                                <div className="message-avatar-placeholder">{msg.username[0].toUpperCase()}</div>
                            )}
                            <div className="message-body">
                                <div className="message-info">
                                    <span className="message-username">{msg.username}</span>
                                    <span className="message-time">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <div className="message-text">{msg.text}</div>
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <form className="chat-input-form" onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type a message..."
                    className="chat-input"
                />
                <button type="submit" className="chat-send-btn">SEND</button>
            </form>
        </div>
    );
}
