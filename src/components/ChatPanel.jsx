import React, { useState, useRef, useEffect, Component } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Bot, User, Loader2, BrainCircuit, ChevronDown, ChevronRight, X } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <div className="text-red-500 text-xs p-2">MD Err: {this.state.error.message}</div>;
    }
    return this.props.children;
  }
}

export default function ChatPanel({ isOpen, onClose, apiKey }) {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('gemini_chat_history');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { role: 'model', content: "Hi! I am Antigravity's Grading Assistant. Ask me anything about your class grades, rankings, or performance trends." }
    ];
  });

  useEffect(() => {
    localStorage.setItem('gemini_chat_history', JSON.stringify(messages));
  }, [messages]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedThoughts, setExpandedThoughts] = useState({});
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.min(scrollHeight, 112) + 'px';
      textareaRef.current.style.overflowY = scrollHeight > 112 ? 'auto' : 'hidden';
    }
  }, [input]);

  const toggleThought = (idx) => {
    setExpandedThoughts(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleSend = async (e, overrideText = null) => {
    e?.preventDefault();
    const textToSend = overrideText || input;
    if (!textToSend.trim() || isLoading) return;

    if (!overrideText) setInput('');
    setIsLoading(true);

    const currentMessages = [...messages, { role: 'user', content: textToSend.trim() }];
    const nextIdx = currentMessages.length;
    let thinking = '';
    let reply = '';
    let suggestions = [];

    setMessages([...currentMessages, { role: 'model', content: '', thoughts: '', suggestions: [] }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend.trim(),
          history: currentMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
          apiKey: apiKey || ""
        })
      });

      if (!response.body) {
        throw new Error("No response body.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        setIsLoading(false); // Hide the global loader when stream begins
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete fragments

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (dataStr === '[DONE]') break;
            if (dataStr) {
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.type === 'THOUGHT') {
                  thinking += parsed.content;
                } else if (parsed.type === 'SUGGESTION') {
                  suggestions.push(parsed.content);
                } else {
                  reply += parsed.content;
                }

                setMessages(prev => {
                  const updated = [...prev];
                  updated[nextIdx] = {
                    role: 'model',
                    content: reply,
                    thoughts: thinking,
                    suggestions: suggestions
                  };
                  return updated;
                });
              } catch (e) {
                console.error('JSON parse fail:', dataStr);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      setMessages([...currentMessages, { role: 'model', content: `⚠️ Error connecting to assistant: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`fixed top-0 right-0 h-full w-[420px] bg-white dark:bg-[#0c0c0f] shadow-2xl border-l border-zinc-200 dark:border-zinc-800 flex flex-col transition-transform duration-300 z-50 no-print ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-emerald-ink" />
          <span className="font-bold text-sm uppercase tracking-wider">Gemini SBA Assistant</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
          <X className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-zinc-50/50 dark:bg-zinc-900/10">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              m.role === 'user' 
                ? 'bg-blue-500 text-white' 
                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
            }`}>
              {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            
            <div className="max-w-[85%] flex flex-col gap-1.5">
              
              {/* Thoughts Box (Collapsible) */}
              {m.role === 'model' && m.thoughts && m.thoughts.trim().length > 0 && (
                <div className="bg-zinc-100/80 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-xl overflow-hidden shadow-sm">
                  <button
                    onClick={() => toggleThought(i)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"
                  >
                    {expandedThoughts[i] ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
                    <BrainCircuit className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    <span className="truncate text-left flex-1">
                      {m.content && m.content.length > 0 ? "Reasoning Process" : "Analyzing records..."}
                    </span>
                  </button>
                  {expandedThoughts[i] && (
                    <div className="px-3 pb-3 pt-2 border-t border-zinc-200 dark:border-zinc-800 max-h-[250px] overflow-y-auto bg-zinc-50 dark:bg-black/10 text-[10px] font-mono leading-relaxed text-zinc-500 dark:text-zinc-400 flex flex-col gap-1.5">
                      {m.thoughts.split('\n').filter(l => l.trim().length > 0).map((line, idx) => (
                        <div key={idx} className="flex gap-1.5 items-start">
                          <div className="text-blue-500/70 mt-[2px] font-bold">›</div>
                          <div className="break-words whitespace-pre-wrap">{line}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Waiting status */}
              {m.role === 'model' && !m.content && !expandedThoughts[i] && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-400 italic px-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" /> Thinking...
                </div>
              )}

              {/* Final response */}
              {m.content && (
                <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                  m.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none shadow-sm' 
                    : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-tl-none shadow-sm'
                }`}>
                  {m.role === 'model' ? (
                    <ErrorBoundary>
                      <div className="[&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:list-disc [&>ul]:ml-5 [&>h3]:font-bold [&>h3]:text-zinc-900 dark:[&>h3]:text-zinc-50 [&>h3]:mb-1 [&>h3]:mt-3 [&>ol]:list-decimal [&>ol]:ml-5 [&_code]:bg-zinc-100 dark:[&_code]:bg-zinc-850 [&_code]:px-1 [&_code]:rounded font-sans">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    </ErrorBoundary>
                  ) : (
                    <div className="whitespace-pre-wrap font-semibold tracking-tight">{m.content}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-3 border-t border-zinc-200 dark:border-zinc-800 flex items-end bg-zinc-50 dark:bg-[#0c0c0f] relative">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder="Ask grading queries (e.g. List top students in science)..."
          rows={1}
          className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-xl pl-4 pr-12 py-3 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-ink text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 resize-none max-h-28"
        />
        <button 
          type="submit" 
          disabled={!input.trim() || isLoading} 
          className="absolute right-5 bottom-5 p-2 bg-emerald-ink hover:bg-emerald-900 disabled:opacity-50 text-white rounded-full transition-colors shadow"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
