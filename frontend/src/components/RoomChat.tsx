import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, X } from 'lucide-react';
import { ClientEvents, ServerEvents, ChatMessage } from '../types/whiteboard.types';

interface RoomChatProps {
    socket: Socket | null;
    roomId: string;
    user: any;
}

const RoomChat: React.FC<RoomChatProps> = ({ socket, roomId, user }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (message: ChatMessage) => {
            setMessages((prev) => [...prev, message]);
        };

        socket.on(ServerEvents.CHAT_MESSAGE, handleNewMessage);

        return () => {
            socket.off(ServerEvents.CHAT_MESSAGE, handleNewMessage);
        };
    }, [socket]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || !socket || !roomId) return;

        const socketId = socket.id || `guest-${Math.random().toString(36).substr(2, 9)}`;
        const currentUserId = user?.id || socketId;
        const currentUserName = user?.username || user?.email?.split('@')[0] || `User-${socketId.substring(0, 4)}`;

        const messagePayload = {
            roomId,
            userId: currentUserId,
            userName: currentUserName,
            message: inputValue.trim(),
        };

        // Emit to server
        socket.emit(ClientEvents.CHAT_MESSAGE, messagePayload);

        // Optimistically add to local state
        const optimisticMessage: ChatMessage = {
            id: Math.random().toString(36).substring(2, 9),
            userId: currentUserId,
            userName: currentUserName,
            message: inputValue.trim(),
            timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, optimisticMessage]);
        setInputValue('');
    };

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <>
            {/* Floating Chat Button */}
            {!isOpen && (
                <motion.button
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    onClick={() => setIsOpen(true)}
                    className="absolute bottom-4 right-4 bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-lg z-50 flex items-center justify-center transition-colors"
                >
                    <MessageSquare size={24} />
                    {/* Optional unread badge could go here */}
                </motion.button>
            )}

            {/* Chat Window */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ y: 50, opacity: 0, scale: 0.95 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: 50, opacity: 0, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="absolute bottom-4 right-4 w-80 h-96 bg-white rounded-2xl shadow-2xl border border-zinc-200 flex flex-col overflow-hidden z-50 font-sans"
                    >
                        {/* Header */}
                        <div className="bg-indigo-600 text-white p-4 flex justify-between items-center shadow-md z-10">
                            <div className="flex items-center gap-2">
                                <MessageSquare size={18} />
                                <h3 className="font-bold">Room Chat</h3>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-indigo-500 rounded-lg transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 bg-stone-50 flex flex-col gap-3">
                            {messages.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-zinc-400">
                                    <MessageSquare size={32} className="mb-2 opacity-50" />
                                    <p className="text-sm">No messages yet.</p>
                                    <p className="text-xs">Start the conversation!</p>
                                </div>
                            ) : (
                                messages.map((msg, idx) => {
                                    const socketId = socket?.id || '';
                                    const isMe = msg.userId === user?.id || msg.userId === socketId;

                                    // Add a date divider logic optionally, but keep it simple for now
                                    const showName = idx === 0 || messages[idx - 1].userId !== msg.userId;

                                    return (
                                        <div
                                            key={msg.id}
                                            className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                                        >
                                            {showName && !isMe && (
                                                <span className="text-[10px] text-zinc-500 ml-1 mb-0.5 font-bold">
                                                    {msg.userName}
                                                </span>
                                            )}
                                            <div
                                                className={`max-w-[85%] px-3 py-2 rounded-2xl ${isMe
                                                        ? 'bg-indigo-600 text-white rounded-tr-sm'
                                                        : 'bg-white border border-zinc-200 text-zinc-800 rounded-tl-sm shadow-sm'
                                                    }`}
                                            >
                                                <p className="text-sm leading-relaxed whitespace-pre-wrap word-break-all">
                                                    {msg.message}
                                                </p>
                                                <span
                                                    className={`text-[9px] mt-1 block ${isMe ? 'text-indigo-200 text-right' : 'text-zinc-400'
                                                        }`}
                                                >
                                                    {formatTime(msg.timestamp)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <form
                            onSubmit={handleSendMessage}
                            className="p-3 bg-white border-t border-zinc-100 flex items-center gap-2"
                        >
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="Type a message..."
                                className="flex-1 bg-zinc-100 px-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                            />
                            <button
                                type="submit"
                                disabled={!inputValue.trim()}
                                className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Send size={18} />
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default RoomChat;
