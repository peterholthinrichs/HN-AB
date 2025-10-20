import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, ArrowUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import { useToast } from "@/hooks/use-toast";
import { Message, ChatSession } from "@/types/chat";
import { PdfPreviewDialog } from "@/components/PdfPreviewDialog";
import { getAuthToken } from "@/lib/auth";
import DOMPurify from 'dompurify';
import { supabase } from "@/integrations/supabase/client";

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
  const [pdfPreview, setPdfPreview] = useState<{
    url: string;
    filename: string;
  } | null>(null);
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

  const streamResponse = async (userMessage: string): Promise<void> => {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Niet geauthenticeerd');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openai-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        message: userMessage,
        threadId: threadId,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Authentication failed - redirect to login
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
        throw new Error('Sessie verlopen, log opnieuw in');
      }
      if (response.status === 429) {
        throw new Error('Te veel verzoeken, probeer het later opnieuw');
      }
      if (response.status === 402) {
        throw new Error('Betaling vereist, voeg fondsen toe aan je account');
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let streamedText = '';

    if (!reader) {
      throw new Error('No response body');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            // Check if we received any content
            if (!streamedText.trim()) {
              // No answer received
              setMessages((prev) => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  role: 'assistant',
                  content: 'Geen antwoord ontvangen, probeer het opnieuw.'
                };
                return newMessages;
              });
              toast({
                title: "Geen antwoord",
                description: "Probeer je vraag opnieuw te stellen",
                variant: "destructive",
              });
            }
            setIsLoading(false);
            return;
          }

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'thread' && parsed.threadId) {
              setThreadId(parsed.threadId);
            } else if (parsed.type === 'token' && parsed.content) {
              streamedText += parsed.content;
              // Update the last message with accumulated text
              setMessages((prev) => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  role: 'assistant',
                  content: streamedText
                };
                return newMessages;
              });
            } else if (parsed.type === 'citations' && parsed.citations) {
              // Add citations to the last message
              setMessages((prev) => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  ...newMessages[newMessages.length - 1],
                  citations: parsed.citations
                };
                return newMessages;
              });
            }
          } catch (e) {
            console.error('Error parsing SSE:', e);
          }
        }
      }
    }
  };

  const handleSend = async () => {
    const trimmedMessage = message.trim();
    
    if (!trimmedMessage || isLoading) return;
    
    // Validate message length
    const MAX_MESSAGE_LENGTH = 2000;
    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      toast({
        title: "Bericht te lang",
        description: `Maximum ${MAX_MESSAGE_LENGTH} tekens toegestaan`,
        variant: "destructive",
      });
      return;
    }

    setMessage("");
    setMessages((prev) => [...prev, { role: "user", content: trimmedMessage }]);
    setIsLoading(true);

    // Add empty assistant message for streaming
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      console.log("Streaming message...");
      await streamResponse(trimmedMessage);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Fout",
        description: error instanceof Error ? error.message : "Er is een fout opgetreden",
        variant: "destructive",
      });
      // Remove the empty assistant message on error
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
                      __html: DOMPurify.sanitize(
                        msg.content.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>"),
                        { ALLOWED_TAGS: ['strong', 'em', 'br', 'p', 'ul', 'ol', 'li'] }
                      ),
                    }}
                  />
                    {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border/40">
                        <div className="text-xs font-semibold text-muted-foreground mb-2">Bronnen:</div>
                      {msg.citations.map((citation, idx) => {
                          // Normalize filename with consistent logic
                          const filename = citation.filename || `Bron ${idx + 1}`;
                          const pdfFilename = filename
                            .trim()                          // First trim whitespace
                            .replace(/\s+/g, '_')            // Replace spaces with underscores
                            .replace(/\.txt$/i, '.pdf')      // Convert .txt to .pdf
                            .replace(/_+/g, '_')             // Consolidate multiple underscores
                            .replace(/_+\.pdf$/i, '.pdf');   // Remove trailing underscores before .pdf
                          
                          // Get public URL from storage
                          const { data } = supabase.storage.from("documents").getPublicUrl(pdfFilename);
                          const documentUrl = data.publicUrl;
                          
                          return (
                            <div key={idx} className="text-xs text-muted-foreground mb-2">
                              <span className="font-medium">
                                 • <button 
                                    onClick={() => setPdfPreview({
                                      url: documentUrl,
                                      filename: pdfFilename
                                    })}
                                    className="hover:underline hover:text-foreground transition-colors cursor-pointer"
                                  >
                                    {pdfFilename}
                                  </button>
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
                    <span className="text-xs text-muted-foreground">Aan het typen...</span>
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

      <PdfPreviewDialog
        open={!!pdfPreview}
        onOpenChange={(open) => !open && setPdfPreview(null)}
        pdfUrl={pdfPreview?.url || ''}
        filename={pdfPreview?.filename || ''}
      />
    </div>
  );
};
