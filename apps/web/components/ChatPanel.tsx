"use client";

import { useState, useRef, useEffect } from "react";
import { Send, MessageCircle, X } from "lucide-react";

export interface ChatMessage {
  id?: number;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  currentUserId?: string;
}

export default function ChatPanel({
  messages,
  onSendMessage,
  isOpen,
  onToggle,
  currentUserId,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    onSendMessage(text);
    setInput("");
  };

  if (!isOpen) {
    return (
      <button className="chat-toggle-btn" onClick={onToggle} title="Open chat">
        <MessageCircle size={18} />
        {messages.length > 0 && (
          <span className="chat-toggle-count">{messages.length}</span>
        )}
      </button>
    );
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <MessageCircle size={14} /> Room Chat
        </span>
        <button onClick={onToggle} className="chat-close-btn">
          <X size={14} />
        </button>
      </div>

      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && (
          <div className="chat-empty">No messages yet. Say hi! 👋</div>
        )}
        {messages.map((msg, i) => (
          <div
            key={msg.id ?? i}
            className={`chat-msg ${msg.userId === currentUserId ? "chat-msg-own" : ""}`}
          >
            <div className="chat-msg-name">{msg.userName}</div>
            <div className="chat-msg-text">{msg.content}</div>
            <div className="chat-msg-time">
              {new Date(msg.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="chat-input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
          autoComplete="off"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="chat-send-btn"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
