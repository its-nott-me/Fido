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

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 900;
const MIN_WIDTH = 300;
const MIN_HEIGHT = 300;

export default function Chat({ messages, onSendMessage, onClose }: Omit<ChatProps, 'ws'>) {
    const { user } = useAuth();
    const [inputText, setInputText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Drag and resize state
    const [position, setPosition] = useState({ x: window.innerWidth - DEFAULT_WIDTH - 20, y: 20 });
    const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
    const [isDragging, setIsDragging] = useState(false);
    const [resizeDirection, setResizeDirection] = useState<ResizeDirection | null>(null);
    const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1024);

    const dragOffsetRef = useRef({ x: 0, y: 0 });
    const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Handle screen resize
    useEffect(() => {
        const handleResize = () => {
            const isLarge = window.innerWidth >= 1024;
            setIsLargeScreen(isLarge);

            // Reset position when switching to/from large screen
            if (!isLarge) {
                setPosition({ x: 20, y: window.innerHeight - DEFAULT_HEIGHT - 20 });
                setSize({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
            } else {
                setPosition({ x: window.innerWidth - DEFAULT_WIDTH - 20, y: 20 });
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Drag handlers
    const handleDragStart = (e: React.MouseEvent) => {
        if (!isLargeScreen || resizeDirection) return;

        setIsDragging(true);
        dragOffsetRef.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
    };

    const handleDragMove = (e: MouseEvent) => {
        if (!isDragging || !isLargeScreen) return;

        const newX = e.clientX - dragOffsetRef.current.x;
        const newY = e.clientY - dragOffsetRef.current.y;

        // Constrain to viewport
        const maxX = window.innerWidth - size.width;
        const maxY = window.innerHeight - size.height;

        setPosition({
            x: Math.max(0, Math.min(newX, maxX)),
            y: Math.max(0, Math.min(newY, maxY))
        });
    };

    const handleDragEnd = () => {
        setIsDragging(false);
    };

    // Resize handlers
    const handleResizeStart = (e: React.MouseEvent, direction: ResizeDirection) => {
        if (!isLargeScreen) return;

        e.stopPropagation();
        e.preventDefault();
        setResizeDirection(direction);
        resizeStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            width: size.width,
            height: size.height,
            posX: position.x,
            posY: position.y
        };
    };

    const handleResizeMove = (e: MouseEvent) => {
        if (!resizeDirection || !isLargeScreen) return;

        const deltaX = e.clientX - resizeStartRef.current.x;
        const deltaY = e.clientY - resizeStartRef.current.y;

        let newWidth = resizeStartRef.current.width;
        let newHeight = resizeStartRef.current.height;
        let newX = resizeStartRef.current.posX;
        let newY = resizeStartRef.current.posY;

        if (resizeDirection.includes('e')) {
            newWidth = resizeStartRef.current.width + deltaX;
        } else if (resizeDirection.includes('w')) {
            newWidth = resizeStartRef.current.width - deltaX;
            newX = resizeStartRef.current.posX + deltaX;
        }

        if (resizeDirection.includes('s')) {
            newHeight = resizeStartRef.current.height + deltaY;
        } else if (resizeDirection.includes('n')) {
            newHeight = resizeStartRef.current.height - deltaY;
            newY = resizeStartRef.current.posY + deltaY;
        }

        // Apply size constraints
        if (newWidth < MIN_WIDTH) {
            if (resizeDirection.includes('w')) {
                newX = resizeStartRef.current.posX + (resizeStartRef.current.width - MIN_WIDTH);
            }
            newWidth = MIN_WIDTH;
        }
        if (newHeight < MIN_HEIGHT) {
            if (resizeDirection.includes('n')) {
                newY = resizeStartRef.current.posY + (resizeStartRef.current.height - MIN_HEIGHT);
            }
            newHeight = MIN_HEIGHT;
        }

        // Apply viewport constraints for position changes
        if (newX < 0) {
            newWidth += newX;
            newX = 0;
        }
        if (newY < 0) {
            newHeight += newY;
            newY = 0;
        }
        if (newX + newWidth > window.innerWidth) {
            newWidth = window.innerWidth - newX;
        }
        if (newY + newHeight > window.innerHeight) {
            newHeight = window.innerHeight - newY;
        }

        setSize({ width: newWidth, height: newHeight });
        setPosition({ x: newX, y: newY });
    };

    const handleResizeEnd = () => {
        setResizeDirection(null);
    };

    // Mouse event listeners
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleDragMove);
            window.addEventListener('mouseup', handleDragEnd);
            return () => {
                window.removeEventListener('mousemove', handleDragMove);
                window.removeEventListener('mouseup', handleDragEnd);
            };
        }
    }, [isDragging, position, size]);

    useEffect(() => {
        if (resizeDirection) {
            window.addEventListener('mousemove', handleResizeMove);
            window.addEventListener('mouseup', handleResizeEnd);
            return () => {
                window.removeEventListener('mousemove', handleResizeMove);
                window.removeEventListener('mouseup', handleResizeEnd);
            };
        }
    }, [resizeDirection, position, size]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputText.trim()) {
            onSendMessage(inputText);
            setInputText('');
        }
    };

    const containerStyle: React.CSSProperties = isLargeScreen ? {
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        right: 'auto',
        bottom: 'auto',
        userSelect: (isDragging || !!resizeDirection) ? 'none' : 'auto'
    } : {};

    const resizeHandles: ResizeDirection[] = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'];

    return (
        <div
            className={`chat-container glass-module ${isDragging ? 'chat-dragging' : ''} ${resizeDirection ? 'chat-resizing' : ''}`}
            style={containerStyle}
        >
            {/* Multi-directional resize handles */}
            {isLargeScreen && resizeHandles.map(dir => (
                <div
                    key={dir}
                    className={`chat-resize-handle handle-${dir}`}
                    onMouseDown={(e) => handleResizeStart(e, dir)}
                />
            ))}

            <div
                className="chat-header"
                onMouseDown={handleDragStart}
                style={{ cursor: isLargeScreen ? 'move' : 'default' }}
            >
                <h3>CHAT</h3>
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
