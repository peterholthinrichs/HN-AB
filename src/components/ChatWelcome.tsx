import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, ArrowUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import { useToast } from "@/hooks/use-toast";

const suggestions = [
  "Zoek in het prijzenboek het meest passende onderdeel bij de omschrijving van het werk.",
  "Maak een berekening voor meerdere onderhoudsscenario's",
  "Bereken de Total Cost of Ownership voor een onderhoudsmaatregel.",
];

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const ChatWelcome = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || isLoading) return;

    const userMessage = message.trim();
    setMessage("");
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      console.log('Sending message to edge function...');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
        },
        body: JSON.stringify({
          message: userMessage,
          threadId: threadId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Get thread ID from response headers
      const newThreadId = response.headers.get('X-Thread-Id');
      if (newThreadId && !threadId) {
        console.log('Thread ID received:', newThreadId);
        setThreadId(newThreadId);
      }

      // Process streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      if (reader) {
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                
                // Handle text deltas
                if (parsed.event === 'thread.message.delta') {
                  const content = parsed.data?.delta?.content?.[0];
                  if (content?.type === 'text' && content?.text?.value) {
                    assistantMessage += content.text.value;
                    setMessages(prev => {
                      const newMessages = [...prev];
                      newMessages[newMessages.length - 1] = {
                        role: 'assistant',
                        content: assistantMessage
                      };
                      return newMessages;
                    });
                  }
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e);
              }
            }
          }
        }
      }

      console.log('Message processing complete');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Fout",
        description: error instanceof Error ? error.message : "Er is een fout opgetreden bij het verzenden van het bericht",
        variant: "destructive"
      });
      // Remove the last assistant message if there was an error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-4xl mx-auto w-full">
        {/* Welcome Icon */}
        <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center mb-6 overflow-hidden">
          <img src={logo} alt="POOL techniek logo" className="w-full h-full object-cover" />
        </div>

        {/* Welcome Text */}
        <h1 className="text-3xl font-semibold text-foreground mb-12">
          Waar kan ik je mee helpen?
        </h1>

        {/* Message Input */}
        <div className="w-full max-w-2xl mb-8">
          <div className="relative">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ik moet een offerte maken voor Hof Wonen voor het aanbrengen van 50m2 gevel"
              className="w-full px-6 py-4 pr-14 rounded-2xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-sm"
              disabled={isLoading}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={isLoading || !message.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-foreground hover:bg-foreground/90 text-background disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ArrowUp className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Suggestions */}
        <div className="w-full max-w-2xl space-y-3">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => setMessage(suggestion)}
              disabled={isLoading}
              className="w-full flex items-start gap-3 p-4 rounded-xl bg-card border border-border hover:bg-muted/30 transition-colors text-left group disabled:opacity-50"
            >
              <MessageSquare className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                {suggestion}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        <div className="max-w-4xl mx-auto">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex gap-4 mb-6 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 overflow-hidden">
                  <img src={logo} alt="AI" className="w-full h-full object-cover" />
                </div>
              )}
              <div
                className={`max-w-[70%] p-4 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-foreground text-background'
                    : 'bg-card border border-border text-foreground'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex gap-4 mb-6">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 overflow-hidden">
                <img src={logo} alt="AI" className="w-full h-full object-cover" />
              </div>
              <div className="max-w-[70%] p-4 rounded-2xl bg-card border border-border">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-4 bg-background">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Typ je bericht hier..."
              disabled={isLoading}
              className="w-full px-6 py-4 pr-14 rounded-2xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-sm"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={isLoading || !message.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-foreground hover:bg-foreground/90 text-background disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ArrowUp className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
