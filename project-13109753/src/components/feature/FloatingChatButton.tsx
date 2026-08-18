import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  id: number;
  role: ChatRole;
  content: string;
}

const WELCOME_MESSAGE =
  'Ask me anything about Kamakura, Enoshima, or the Shonan coast — I know the spots locals actually go to.';

const ERROR_MESSAGE =
  "Sorry, I'm having trouble right now. Please try again in a moment.";

export default function FloatingChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, role: 'assistant', content: WELCOME_MESSAGE },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const location = useLocation();

  const listRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(2);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading]);

  if (location.pathname.startsWith('/admin')) {
    return null;
  }

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: idRef.current++,
      role: 'user',
      content: text,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    const history = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });

      const data = await res.json();

      if (res.ok && data.reply) {
        setMessages((prev) => [
          ...prev,
          { id: idRef.current++, role: 'assistant', content: data.reply },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { id: idRef.current++, role: 'assistant', content: ERROR_MESSAGE },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: idRef.current++, role: 'assistant', content: ERROR_MESSAGE },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-4 md:right-6 z-[60] w-[calc(100vw-2rem)] max-w-sm h-[520px] max-h-[70vh] flex flex-col bg-background-50 border border-background-200 rounded-2xl overflow-hidden shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-primary-500 text-white">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <i className="ri-chat-3-line text-lg"></i>
              </span>
              <div>
                <h2 className="font-heading font-semibold text-base leading-tight">
                  Ask TABI
                </h2>
                <span className="text-xs text-white/80">Your local guide</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:bg-white/20 transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-lg"></i>
            </button>
          </div>

          {/* Messages */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-primary-500 text-white rounded-br-md'
                      : 'bg-background-100 text-foreground-800 rounded-bl-md'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-background-100 px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 px-4 py-3 border-t border-background-200"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about Kamakura, Enoshima…"
              className="flex-1 text-sm px-4 py-2.5 rounded-full bg-background-100 text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              aria-label="Send message"
              className="w-10 h-10 rounded-full bg-primary-500 hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <i className="ri-send-plane-2-fill text-lg"></i>
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Ask TABI AI"
        className="fixed bottom-6 right-4 md:right-6 z-[60] w-14 h-14 rounded-full bg-primary-500 hover:bg-primary-600 text-white flex items-center justify-center cursor-pointer transition-all duration-200"
      >
        <i className={`${isOpen ? 'ri-close-line' : 'ri-chat-3-line'} text-2xl`}></i>
      </button>
    </>
  );
}