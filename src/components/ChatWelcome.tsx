import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, ArrowUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import { useToast } from "@/hooks/use-toast";
import { Message, ChatSession } from "@/types/chat";

const suggestions = [
  "Welke sensoren (Shr2, Shr3, Shr4, Shr8) zijn verplicht voor een veilige werking van de warmteterugwinning, en waar worden ze geplaatst?",
  "Hoe regelt de AK-PC 782A de condensatiedruk tijdens de transkritische en subkritische fasen bij actieve warmteterugwinning?",
  "Hoe werkt de RTK ELECTRISCHE AANDRIJVING RE-ACT 30E/DC?",
];

interface ChatWelcomeProps {
  currentSession: ChatSession | null;
  onSessionUpdate: (messages: Message[], threadId: string | null) => void;
}

export const ChatWelcome = ({ currentSession, onSessionUpdate }: ChatWelcomeProps) => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>(currentSession?.messages || []);
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(currentSession?.threadId || null);
  const [runStatus, setRunStatus] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Update session when messages or threadId change
  useEffect(() => {
    if (messages.length > 0 || threadId) {
      onSessionUpdate(messages, threadId);
    }
  }, [messages, threadId]);

  // Load session when currentSession changes
  useEffect(() => {
    if (currentSession) {
      setMessages(currentSession.messages);
      setThreadId(currentSession.threadId);
      setMessage("");
      setRunStatus("");
      setIsLoading(false);
    }
  }, [currentSession?.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const pollRunStatus = async (
    threadId: string,
    runId: string,
  ): Promise<{ text: string; citations?: Array<{ file_id: string; filename?: string; quote?: string }> }> => {
    const maxAttempts = 60; // 60 seconds max
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 300)); // Wait 300ms for faster updates

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openai-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ threadId, runId }),
      });

      const data = await response.json();
      console.log("Poll result:", data);

      // Update run status for UI feedback
      setRunStatus(data.status || "");

      if (data.status === "completed") {
        setRunStatus("");
        return { text: data.text, citations: data.citations };
      } else if (data.status === "failed" || data.status === "cancelled" || data.status === "expired") {
        setRunStatus("");
        throw new Error(data.error || "Run failed");
      }

      attempts++;
    }

    throw new Error("Timeout waiting for response");
  };

  const handleSend = async () => {
    if (!message.trim() || isLoading) return;

    const userMessage = message.trim();
    setMessage("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      console.log("Sending message...");

      // Create run
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openai-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          message: userMessage,
          threadId: threadId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Run created:", data);

      if (data.threadId && !threadId) {
        setThreadId(data.threadId);
      }

      // Add empty assistant message
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      // Poll for completion
      const result = await pollRunStatus(data.threadId, data.runId);

      // Update assistant message
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          role: "assistant",
          content: result.text,
          citations: result.citations,
        };
        return newMessages;
      });
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Fout",
        description: error instanceof Error ? error.message : "Er is een fout opgetreden",
        variant: "destructive",
      });
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-4xl mx-auto w-full">
        <div className="w-16 h-16 flex items-center justify-center mb-6">
          <img src={logo} alt="POOL techniek logo" className="w-full h-full object-contain" />
        </div>

        <h1 className="text-3xl font-semibold text-foreground mb-12">Waar kan ik je mee helpen?</h1>

        <div className="w-full max-w-2xl mb-8">
          <div className="relative">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Wat voor werkzaamheden zijn verricht voor Holiday Ice?"
              className="w-full px-6 py-4 pr-14 rounded-2xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-sm"
              disabled={isLoading}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={isLoading || !message.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-foreground hover:bg-foreground/90 text-background disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowUp className="w-5 h-5" />}
            </Button>
          </div>
        </div>

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
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        <div className="max-w-4xl mx-auto">
          {messages.map((msg, index) => (
            <div key={index} className={`flex gap-4 mb-6 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <img src={logo} alt="AI" className="w-full h-full object-contain" />
                </div>
              )}
              <div
                className={`max-w-[70%] p-4 rounded-2xl ${
                  msg.role === "user" ? "bg-foreground text-background" : "bg-card border border-border text-foreground"
                }`}
              >
                {msg.content ? (
                  <>
                    <div
                      className="text-sm whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{
                        __html: msg.content.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>"),
                      }}
                    />
                    {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border/40">
                        <div className="text-xs font-semibold text-muted-foreground mb-2">Bronnen:</div>
                        {msg.citations.map((citation, idx) => {
                          // Convert .txt extension to .pdf for document links
                          const filename = citation.filename || `Bron ${idx + 1}`;
                          const pdfFilename = filename.replace(/\.txt$/, '.pdf');
                          
                          // Use local URL as primary fallback (works immediately)
                          // Falls back to storage URL if local file is not available
                          const localUrl = `/documents/${pdfFilename}`;
                          const storageUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/documents/${pdfFilename}`;
                          
                          // Try local first, storage as backup
                          const documentUrl = localUrl;
                          
                          return (
                            <div key={idx} className="text-xs text-muted-foreground mb-2">
                              <span className="font-medium">
                                • <a 
                                    href={documentUrl}
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="hover:underline hover:text-foreground transition-colors"
                                    onError={(e) => {
                                      // Fallback to storage URL if local fails
                                      e.currentTarget.href = storageUrl;
                                    }}
                                  >
                                    {pdfFilename}
                                  </a>
                              </span>
                              {citation.quote && <div className="ml-3 mt-1 italic opacity-80">"{citation.quote}"</div>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {runStatus === "requires_action"
                        ? "Zoeken in documenten..."
                        : runStatus === "in_progress"
                          ? "Aan het nadenken..."
                          : runStatus === "queued"
                            ? "In de wachtrij..."
                            : "Bezig..."}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

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
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowUp className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
