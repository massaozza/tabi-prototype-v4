import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

type ChatRole = 'user' | 'assistant';

interface CitedExperience {
  id: string;
  placeName: string;
  category: string;
  area: string;
  authorName: string;
  whatWasGood: string;
  wouldRecommend: boolean;
  photos: string[];
}

interface ChatMessage {
  id: number;
  role: ChatRole;
  content: string;
  citedExperiences?: CitedExperience[];
}

interface TripDayItem {
  time?: string;
  title: string;
  description?: string;
}

interface TripStay {
  hotelName: string;
  checkInDay: number;
  checkOutDay: number;
}

interface TripMeals {
  breakfast?: { suggestion: string };
  lunch?: { suggestion: string };
  dinner?: { suggestion: string };
}

interface TripDay {
  day: number;
  activities: TripDayItem[];
  meals?: TripMeals;
}

interface StructuredTrip {
  title: string;
  summary: string;
  stays: TripStay[];
  days: TripDay[];
}

const WELCOME_MESSAGE =
  'Ask me anything about Kamakura, Enoshima, or the Shonan coast — I know the spots locals actually go to.';

const ERROR_MESSAGE =
  "Sorry, I'm having trouble right now. Please try again in a moment.";

export default function FloatingChatButton() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, role: 'assistant', content: WELCOME_MESSAGE },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Save as Trip の状態
  const [structuring, setStructuring] = useState(false);
  const [tripPreview, setTripPreview] = useState<StructuredTrip | null>(null);
  const [tripTitle, setTripTitle] = useState('');
  const [tripSaving, setTripSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const location = useLocation();

  const listRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(2);
  const messagesRef = useRef(messages);
  const loadingRef = useRef(loading);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const addAssistantMessage = useCallback(
    (content: string, citedExperiences?: CitedExperience[]) => {
      setMessages((prev) => [
        ...prev,
        { id: idRef.current++, role: 'assistant', content, citedExperiences },
      ]);
    },
    []
  );

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loadingRef.current) {
      return;
    }

    const userMessage: ChatMessage = {
      id: idRef.current++,
      role: 'user',
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    loadingRef.current = true;

    const history = messagesRef.current.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history }),
      });

      const data = await res.json();

      if (res.ok && data.reply) {
        addAssistantMessage(data.reply, data.citedExperiences);
      } else {
        addAssistantMessage(ERROR_MESSAGE);
      }
    } catch {
      addAssistantMessage(ERROR_MESSAGE);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [addAssistantMessage]);

  const handleSaveAsTrip = useCallback(async () => {
    if (!user || structuring) {
      return;
    }

    setStructuring(true);

    const history = messagesRef.current.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch('/api/structure-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ history }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setTripPreview(data);
        setTripTitle(data.title || '');
        setSaveError('');
      } else if (data && data.success === false && data.reason) {
        addAssistantMessage(
          `I couldn't find enough trip details in our conversation yet. ${data.reason}`
        );
      } else {
        addAssistantMessage(ERROR_MESSAGE);
      }
    } catch {
      addAssistantMessage(ERROR_MESSAGE);
    } finally {
      setStructuring(false);
    }
  }, [user, structuring, addAssistantMessage]);

  const handleSaveTrip = useCallback(async () => {
    if (!tripPreview || tripSaving) {
      return;
    }

    setTripSaving(true);
    setSaveError('');

    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: tripTitle.trim(),
          summary: tripPreview.summary,
          stays: tripPreview.stays,
          days: tripPreview.days,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setTripPreview(null);
        setTripTitle('');
        addAssistantMessage('Trip saved! You can view it in My Trips.');
      } else {
        setSaveError(data.error || 'Failed to save your trip. Please try again.');
      }
    } catch {
      setSaveError('Network error. Please try again.');
    } finally {
      setTripSaving(false);
    }
  }, [tripPreview, tripSaving, tripTitle, addAssistantMessage]);

  // カスタムイベント 'tabi:ask-question' を受信して、パネルを開いて質問を自動送信
  useEffect(() => {
    const handleAskQuestion = (event: Event) => {
      const customEvent = event as CustomEvent<{ question?: string }>;
      const question = customEvent.detail?.question;
      if (typeof question === 'string' && question.trim()) {
        setIsOpen(true);
        sendMessage(question);
      }
    };

    window.addEventListener('tabi:ask-question', handleAskQuestion);
    return () => window.removeEventListener('tabi:ask-question', handleAskQuestion);
  }, [sendMessage]);

  if (location.pathname.startsWith('/admin')) {
    return null;
  }

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
            <div className="flex items-center gap-2">
              {user && (
                <button
                  onClick={handleSaveAsTrip}
                  disabled={structuring}
                  aria-label="Save as Trip"
                  className="h-8 px-3 rounded-full bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs font-medium text-white transition-colors cursor-pointer whitespace-nowrap"
                >
                  {structuring ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <i className="ri-bookmark-line text-sm"></i>
                  )}
                  Save as Trip
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:bg-white/20 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
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

                {msg.role === 'assistant' &&
                  msg.citedExperiences &&
                  msg.citedExperiences.length > 0 && (
                    <div className="mt-2 w-full flex flex-col gap-2">
                      {msg.citedExperiences.map((exp) => (
                        <a key={exp.id} href={`/experiences/${exp.id}`} target="_blank" rel="noopener noreferrer" className="w-full flex items-stretch gap-3 p-2.5 rounded-lg bg-accent-100/60 border border-background-200 border-l-4 border-l-accent-500 hover:bg-accent-100/90 transition-colors cursor-pointer">
                          {exp.photos && exp.photos.length > 0 && (
                            <div className="w-16 h-16 shrink-0 rounded-md overflow-hidden">
                              <img
                                src={exp.photos[0]}
                                alt={exp.placeName}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 flex flex-col gap-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-heading font-semibold text-sm text-foreground-950 truncate">
                                {exp.placeName}
                              </span>
                              {exp.wouldRecommend && (
                                <span className="shrink-0 text-green-600">
                                  <i className="ri-checkbox-circle-fill text-sm"></i>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary-100 text-secondary-900 font-medium whitespace-nowrap">
                                {exp.category}
                              </span>
                              <span className="text-[9px] uppercase tracking-wide text-accent-700 font-semibold whitespace-nowrap">
                                Real experience
                              </span>
                            </div>
                            {exp.whatWasGood && (
                              <p className="text-xs text-foreground-700 leading-snug line-clamp-1">
                                {exp.whatWasGood}
                              </p>
                            )}
                            {exp.authorName && (
                              <span className="text-[10px] text-foreground-500">
                                — {exp.authorName}
                              </span>
                            )}
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
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
              sendMessage(input);
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

      {/* Save as Trip プレビューモーダル */}
      {tripPreview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-foreground-950/50"
            onClick={() => {
              if (!tripSaving) {
                setTripPreview(null);
              }
            }}
          ></div>
          <div className="relative w-full max-w-lg max-h-[85vh] flex flex-col bg-background-50 rounded-2xl overflow-hidden shadow-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-background-200">
              <h3 className="font-heading font-semibold text-base text-foreground-950">
                Review Your Trip
              </h3>
              <button
                onClick={() => {
                  if (!tripSaving) {
                    setTripPreview(null);
                  }
                }}
                aria-label="Close preview"
                className="w-8 h-8 rounded-full flex items-center justify-center text-foreground-500 hover:bg-background-100 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
              <div>
                <label
                  htmlFor="trip-title"
                  className="block text-xs font-medium text-foreground-500 mb-1.5"
                >
                  Trip Title
                </label>
                <input
                  id="trip-title"
                  type="text"
                  value={tripTitle}
                  onChange={(e) => setTripTitle(e.target.value)}
                  className="w-full text-sm px-4 py-2.5 rounded-md bg-background-100 text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>

              {tripPreview.summary && (
                <p className="text-sm text-foreground-700 leading-relaxed">
                  {tripPreview.summary}
                </p>
              )}

              {tripPreview.stays && tripPreview.stays.length > 0 && (
                <div className="rounded-lg border border-background-200 bg-background-50 p-4">
                  <h4 className="font-heading font-semibold text-sm text-foreground-950 mb-2">
                    Accommodation
                  </h4>
                  <ul className="flex flex-col gap-1.5">
                    {tripPreview.stays.map((stay, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-foreground-700 leading-relaxed"
                      >
                        <span className="font-medium">{stay.hotelName}</span>
                        <span className="text-foreground-500">
                          {' '}
                          (Day {stay.checkInDay} - Day {stay.checkOutDay})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-col gap-3">
                {tripPreview.days.map((day) => (
                  <div
                    key={day.day}
                    className="rounded-lg border border-background-200 bg-background-50 p-4"
                  >
                    <h4 className="font-heading font-semibold text-sm text-foreground-950 mb-2">
                      Day {day.day}
                    </h4>
                    <ul className="flex flex-col gap-1.5">
                      {day.activities.map((item, idx) => (
                        <li
                          key={idx}
                          className="text-sm text-foreground-700 leading-relaxed"
                        >
                          {item.time && (
                            <span className="font-medium text-foreground-900">
                              {item.time}{' '}
                            </span>
                          )}
                          <span className="font-medium">{item.title}</span>
                          {item.description && (
                            <span className="text-foreground-500">
                              {' '}
                              — {item.description}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>

                    {day.meals &&
                      (day.meals.breakfast ||
                        day.meals.lunch ||
                        day.meals.dinner) && (
                        <div className="mt-3 pt-3 border-t border-background-200">
                          <h5 className="text-xs font-semibold text-foreground-500 uppercase tracking-wide mb-1.5">
                            Meals
                          </h5>
                          <ul className="flex flex-col gap-1">
                            {day.meals.breakfast && (
                              <li className="text-sm text-foreground-700 leading-relaxed">
                                <span className="font-medium">Breakfast:</span>{' '}
                                {day.meals.breakfast.suggestion}
                              </li>
                            )}
                            {day.meals.lunch && (
                              <li className="text-sm text-foreground-700 leading-relaxed">
                                <span className="font-medium">Lunch:</span>{' '}
                                {day.meals.lunch.suggestion}
                              </li>
                            )}
                            {day.meals.dinner && (
                              <li className="text-sm text-foreground-700 leading-relaxed">
                                <span className="font-medium">Dinner:</span>{' '}
                                {day.meals.dinner.suggestion}
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                  </div>
                ))}
              </div>

              {saveError && (
                <p className="text-sm text-red-600 font-medium">{saveError}</p>
              )}
            </div>

            <div className="flex items-center gap-3 px-5 py-4 border-t border-background-200">
              <button
                onClick={() => {
                  if (!tripSaving) {
                    setTripPreview(null);
                  }
                }}
                disabled={tripSaving}
                className="flex-1 h-10 rounded-md border border-background-300 text-foreground-700 hover:bg-background-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTrip}
                disabled={tripSaving || !tripTitle.trim()}
                className="flex-1 h-10 rounded-md bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
              >
                {tripSaving ? 'Saving...' : 'Save Trip'}
              </button>
            </div>
          </div>
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
