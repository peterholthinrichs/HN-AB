import React, { useState, useRef, useEffect, useMemo } from "react";
import { MessageSquare, ArrowUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import { useToast } from "@/hooks/use-toast";
import { Message, ChatSession } from "@/types/chat";
import { PdfPreviewDialog } from "@/components/PdfPreviewDialog";
import { getAuthToken } from "@/lib/auth";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";
import { FunnelState, DEFAULT_FUNNEL } from "@/types/funnel";
import { cn } from "@/lib/utils";

interface MentionCandidate {
  id: string;
  name: string;
  avatar: string;
}

const suggestions = [
  "Stel een feitelijke, empathische terugkoppeling op voor een 2-spoortraject.",
  "Beschrijf hoe divisies elkaar kunnen versterken met voorbeelden.",
  "Schrijf een gespreksverslag in dezelfde stijl als het voorbeeld, met focus op observaties en afspraken.",
];

interface ChatWelcomeProps {
  currentSession: ChatSession | null;
  onSessionUpdate: (messages: Message[], threadId: string | null) => void;
  selectedColleague: string | null;
  assistantMap: Record<string, string>;
  colleagueNames: Record<string, string>;
  colleagueDirectory?: MentionCandidate[];
}

export const ChatWelcome = ({
  currentSession,
  onSessionUpdate,
  selectedColleague,
  assistantMap,
  colleagueNames,
  colleagueDirectory = [],
}: ChatWelcomeProps) => {
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
  const [funnelState, setFunnelState] = useState<FunnelState | null>(null);
  const { toast } = useToast();
 const inputRef = useRef<HTMLInputElement | null>(null);
 const assignInputRef = (element: HTMLInputElement | null) => {
   inputRef.current = element;
 };

  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [highlightIndex, setHighlightIndex] = useState(0);

 const closeMentionMenu = () => {
   setIsMentionOpen(false);
   setMentionQuery("");
   setMentionStart(null);
   setHighlightIndex(0);
 };

 const mentionCandidates = useMemo(() => {
   return colleagueDirectory.filter((colleague) => colleague.id !== selectedColleague);
 }, [colleagueDirectory, selectedColleague]);

 const filteredMentions = useMemo(() => {
   if (!isMentionOpen) return mentionCandidates;
   if (!mentionQuery) return mentionCandidates;
   const query = mentionQuery.toLowerCase();
   return mentionCandidates.filter(
     (colleague) =>
       colleague.name.toLowerCase().includes(query) ||
       colleague.id.toLowerCase().includes(query)
   );
 }, [isMentionOpen, mentionCandidates, mentionQuery]);

 useEffect(() => {
   if (highlightIndex >= filteredMentions.length) {
     setHighlightIndex(0);
   }
 }, [filteredMentions.length, highlightIndex]);

 const detectMentionAtCaret = (value: string, caretPosition: number) => {
   const slice = value.slice(0, caretPosition);
   const match = slice.match(/(^|\s)@([a-zA-Z0-9_-]*)$/);
   if (!match) return null;
   const query = match[2];
   const start = caretPosition - query.length - 1;
   return { query, start };
 };

 const handleMessageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
   const { value, selectionStart } = event.target;
   setMessage(value);

   const caret = selectionStart ?? value.length;
   const mentionInfo = detectMentionAtCaret(value, caret);

   if (mentionInfo) {
     setIsMentionOpen(true);
     setMentionQuery(mentionInfo.query.toLowerCase());
     setMentionStart(mentionInfo.start);
     setHighlightIndex(0);
   } else {
     if (isMentionOpen) {
       closeMentionMenu();
     }
   }
 };

 const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
   if (isMentionOpen && filteredMentions.length > 0) {
     if (event.key === "ArrowDown") {
       event.preventDefault();
       setHighlightIndex((prev) => (prev + 1) % filteredMentions.length);
       return;
     }
     if (event.key === "ArrowUp") {
       event.preventDefault();
       setHighlightIndex((prev) => (prev - 1 + filteredMentions.length) % filteredMentions.length);
       return;
     }
     if (event.key === "Enter" || event.key === "Tab") {
       event.preventDefault();
       const colleague = filteredMentions[highlightIndex];
       if (colleague) {
         handleMentionSelect(colleague);
       }
       return;
     }
     if (event.key === "Escape") {
       event.preventDefault();
       closeMentionMenu();
       return;
     }
   }

   if (event.key === "Escape" && isMentionOpen) {
     closeMentionMenu();
   }
 };

 const handleMentionSelect = (colleague: MentionCandidate) => {
   if (mentionStart == null) return;

   const before = message.slice(0, mentionStart);
   const after = message.slice(mentionStart + mentionQuery.length + 1);
   const insert = `@${colleague.id} `;

   const newValue = `${before}${insert}${after}`;
   setMessage(newValue);
   closeMentionMenu();

   requestAnimationFrame(() => {
     const caretPosition = before.length + insert.length;
     inputRef.current?.focus();
     inputRef.current?.setSelectionRange(caretPosition, caretPosition);
   });
 };

 const handleInputBlur = (event: React.FocusEvent<HTMLInputElement>) => {
   const related = event.relatedTarget as HTMLElement | null;
   if (!related || related.dataset.mentionOption !== "true") {
     closeMentionMenu();
   }
 };

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

  // Extract PDF references from text content as fallback
  const extractPdfReferencesFromText = (content: string): string[] => {
    const patterns = [
      /Bron:\s*([^\s,\n]+\.pdf)/gi, // "Bron: filename.pdf"
      /Bron:\s*([^\s,\n]+\.txt)/gi, // "Bron: filename.txt"
      /Bron:\s*([^\s,\n]+\.json)/gi, // "Bron: filename.json"
      /\b([A-Z][a-zA-Z0-9_-]+\.pdf)\b/g, // Any filename.pdf pattern
    ];

    const matches: string[] = [];
    patterns.forEach((pattern) => {
      const found = content.matchAll(pattern);
      for (const match of found) {
        if (match[1]) {
          // Normalize to PDF format
          const normalized = match[1].replace(/\.(json|txt)$/i, ".pdf").replace(/\s+/g, "_");
          matches.push(normalized);
        }
      }
    });

    return [...new Set(matches)]; // Remove duplicates
  };

  const handleFunnelResponse = (userAnswer: string) => {
    if (!funnelState) return;

    const currentQ = funnelState.questions[funnelState.currentStep];

    // Opslaan antwoord
    const newData = {
      ...funnelState.collectedData,
      [currentQ.id]: userAnswer,
    };

    const nextStep = funnelState.currentStep + 1;
    const isLastQuestion = nextStep >= funnelState.questions.length;

    if (isLastQuestion) {
      // LAATSTE VRAAG → verstuur naar AI
      const compiledPrompt = `
De gebruiker heeft de volgende informatie gegeven:

Oorspronkelijke vraag: ${newData.initial_question || "Geen"}
Component type: ${newData.component_type}
Typenummer: ${newData.type_number}
Details: ${newData.details}

Beantwoord de vraag op basis van de technische documentatie.
      `.trim();

      // Sluit funnel af
      setFunnelState(null);

      // Voeg loading message toe
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "",
        },
      ]);
      setIsLoading(true);

      // Verstuur naar AI
      streamResponse(compiledPrompt).finally(() => setIsLoading(false));
    } else {
      // VOLGENDE VRAAG
      const nextQ = funnelState.questions[nextStep];

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: nextQ.question,
        },
      ]);

      setFunnelState({
        ...funnelState,
        currentStep: nextStep,
        collectedData: newData,
      });
    }
  };

  const streamResponse = async (
    userMessage: string,
    options?: {
      assistantKey?: string | null;
      label?: string;
    }
  ): Promise<{ threadId: string | null }> => {
    const token = getAuthToken();
    if (!token) {
      throw new Error("Niet geauthenticeerd");
    }

    const assistantKey = options?.assistantKey ?? selectedColleague ?? null;
    const assistantId = assistantKey ? assistantMap[assistantKey] : undefined;

    if (!assistantId) {
      throw new Error("Geen assistant gevonden voor deze collega");
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openai-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        message: userMessage,
        threadId: threadId,
        assistantKey,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Authentication failed - redirect to login
        localStorage.removeItem("auth_token");
        window.location.href = "/login";
        throw new Error("Sessie verlopen, log opnieuw in");
      }
      if (response.status === 429) {
        throw new Error("Te veel verzoeken, probeer het later opnieuw");
      }
      if (response.status === 402) {
        throw new Error("Betaling vereist, voeg fondsen toe aan je account");
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamedText = "";
    let updatedThreadId: string | null = threadId;

    if (!reader) {
      throw new Error("No response body");
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            // Check if we received any content
            if (!streamedText.trim()) {
              // No answer received
              setMessages((prev) => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  role: "assistant",
                  content: "Geen antwoord ontvangen, probeer het opnieuw.",
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

            if (parsed.type === "thread" && parsed.threadId) {
              setThreadId(parsed.threadId);
              updatedThreadId = parsed.threadId;
            } else if (parsed.type === "token" && parsed.content) {
              streamedText += parsed.content;
              // Update the last message with accumulated text
              setMessages((prev) => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                const assistantLabel = options?.label || (assistantKey ? colleagueNames[assistantKey] : undefined);
                newMessages[newMessages.length - 1] = {
                  role: "assistant",
                  content: streamedText,
                  assistantId: assistantKey ?? selectedColleague ?? null,
                  assistantLabel,
                };
                return newMessages;
              });
            } else if (parsed.type === "citations" && parsed.citations) {
              // Add citations to the last message
              setMessages((prev) => {
                const newMessages = [...prev];
                const assistantLabel = options?.label || (assistantKey ? colleagueNames[assistantKey] : undefined);
                newMessages[newMessages.length - 1] = {
                  ...newMessages[newMessages.length - 1],
                  citations: parsed.citations,
                  assistantLabel,
                };
                return newMessages;
              });
            }
          } catch (e) {
            console.error("Error parsing SSE:", e);
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

    // Als er nog geen messages zijn EN funnel is niet actief → start funnel
    if (messages.length === 0 && !funnelState) {
      // Voeg user message toe
      setMessages([{ role: "user", content: trimmedMessage }]);

      // Start funnel met eerste vraag
      setFunnelState({
        isActive: true,
        currentStep: 0,
        collectedData: {
          initial_question: trimmedMessage,
        },
        questions: DEFAULT_FUNNEL,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: DEFAULT_FUNNEL[0].question,
        },
      ]);
      return;
    }

    // Als funnel actief is → verwerk funnel antwoord
    if (funnelState?.isActive) {
      setMessages((prev) => [...prev, { role: "user", content: trimmedMessage }]);
      handleFunnelResponse(trimmedMessage);
      return;
    }

    // Normale chat (na funnel)
    setMessages((prev) => [...prev, { role: "user", content: trimmedMessage }]);

    // Detect mentions
    const mentionRegex = /@([a-z0-9_-]+)/gi;
    const mentionedColleagues = Array.from(
      new Set(
        [...trimmedMessage.matchAll(mentionRegex)]
          .map((match) => match[1].toLowerCase())
          .filter((id) => assistantMap[id])
      )
    ).filter((id) => id !== selectedColleague);

    setIsLoading(true);

    // Add empty assistant message for primary colleague
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "",
        assistantId: selectedColleague,
        assistantLabel: selectedColleague ? colleagueNames[selectedColleague] : undefined,
      },
    ]);

    try {
      console.log("Streaming message...");
      const { threadId: latestThreadId } = await streamResponse(trimmedMessage, {
        assistantKey: selectedColleague ?? null,
        label: selectedColleague ? colleagueNames[selectedColleague] : undefined,
      });

      // Sequentially gather input from mentioned colleagues
      for (const colleagueId of mentionedColleagues) {
        // Insert a placeholder bubble for this colleague
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "",
            assistantId: colleagueId,
            assistantLabel: colleagueNames[colleagueId] ?? colleagueId,
          },
        ]);

        await streamResponse(trimmedMessage, {
          assistantKey: colleagueId,
          label: colleagueNames[colleagueId] ?? colleagueId,
        });
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Fout",
        description: error instanceof Error ? error.message : "Er is een fout opgetreden",
        variant: "destructive",
      });
      // Remove the empty assistant messages on error
      setMessages((prev) => prev.filter((msg) => msg.content !== "" || msg.role !== "assistant"));
    } finally {
      setIsLoading(false);
    }
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-4xl mx-auto w-full">
        <div className="w-16 h-16 flex items-center justify-center mb-6">
          <img src={logo} alt="HN-AB logo" className="w-full h-full object-contain" />
        </div>

        <h1 className="text-3xl font-semibold text-foreground mb-12">Waar kan ik je mee helpen?</h1>

        <div className="w-full max-w-2xl mb-8">
          <div className="relative">
            <input
              ref={assignInputRef}
              type="text"
              value={message}
              onChange={(e) => handleMessageChange(e)}
              onKeyDown={(e) => handleInputKeyDown(e)}
              onBlur={handleInputBlur}
              placeholder={
                funnelState?.isActive
                  ? funnelState.questions[funnelState.currentStep].placeholder || "Type je antwoord..."
                  : "Heb je een vraag over componenten, verdampers, compressoren, gaskoelers of condensors?"
              }
              className="w-full px-6 py-4 pr-14 rounded-2xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-sm"
              disabled={isLoading}
            />
            {isMentionOpen && filteredMentions.length > 0 && (
              <div className="absolute left-6 right-6 top-full mt-2 z-50 rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
                {filteredMentions.map((colleague, idx) => (
                  <button
                    key={colleague.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleMentionSelect(colleague);
                    }}
                    data-mention-option="true"
                    className={cn(
                      "flex items-center gap-3 w-full px-3 py-2 text-sm",
                      idx === highlightIndex ? "bg-muted" : "hover:bg-muted/60"
                    )}
                  >
                    <img
                      src={colleague.avatar}
                      alt={colleague.name}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                    <span>{colleague.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">@{colleague.id}</span>
                  </button>
                ))}
              </div>
            )}
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
                        __html: DOMPurify.sanitize(msg.content.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>"), {
                          ALLOWED_TAGS: ["strong", "em", "br", "p", "ul", "ol", "li"],
                        }),
                      }}
                    />
                    {msg.role === "assistant" &&
                      (() => {
                        // Layer 1: Use OpenAI citations if available
                        if (msg.citations && msg.citations.length > 0) {
                          return (
                            <div className="mt-4 pt-4 border-t border-border/40">
                              <div className="text-xs font-semibold text-muted-foreground mb-2">Bronnen:</div>
                              {msg.citations.map((citation, idx) => {
                                // Normalize filename with consistent logic
                                const filename = citation.filename || `Bron ${idx + 1}`;
                                const pdfFilename = filename
                                  .trim() // First trim whitespace
                                  .replace(/\s+/g, "_") // Replace spaces with underscores
                                  .replace(/\.txt$/i, ".pdf") // Convert .txt to .pdf
                                  .replace(/_+/g, "_") // Consolidate multiple underscores
                                  .replace(/_+\.pdf$/i, ".pdf"); // Remove trailing underscores before .pdf

                                // Get public URL from storage
                                const { data } = supabase.storage.from("documents").getPublicUrl(pdfFilename);
                                const documentUrl = data.publicUrl;

                                return (
                                  <div key={idx} className="text-xs text-muted-foreground mb-2">
                                    <span className="font-medium">
                                      •{" "}
                                      <button
                                        onClick={() =>
                                          setPdfPreview({
                                            url: documentUrl,
                                            filename: pdfFilename,
                                          })
                                        }
                                        className="hover:underline hover:text-foreground transition-colors cursor-pointer"
                                      >
                                        {pdfFilename}
                                      </button>
                                    </span>
                                    {citation.quote && (
                                      <div className="ml-3 mt-1 italic opacity-80">"{citation.quote}"</div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }

                        // Layer 2: Parse text for PDF references as fallback
                        const extractedPdfs = extractPdfReferencesFromText(msg.content);
                        if (extractedPdfs.length > 0) {
                          return (
                            <div className="mt-4 pt-4 border-t border-border/40">
                              <div className="text-xs font-semibold text-muted-foreground mb-2">
                                Bronnen (uit tekst gedetecteerd):
                              </div>
                              {extractedPdfs.map((filename, idx) => {
                                const { data } = supabase.storage.from("documents").getPublicUrl(filename);
                                return (
                                  <div key={idx} className="text-xs text-muted-foreground mb-2">
                                    <span className="font-medium">
                                      •{" "}
                                      <button
                                        onClick={() => setPdfPreview({ url: data.publicUrl, filename })}
                                        className="hover:underline hover:text-foreground transition-colors cursor-pointer"
                                      >
                                        {filename}
                                      </button>
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }

                        // Layer 3: Generic fallback if no sources found
                        return (
                          <div className="mt-4 pt-4 border-t border-border/40">
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                              <span>ℹ️</span>
                              <span className="italic">
                                Dit antwoord is gebaseerd op de beschikbare technische documentatie
                              </span>
                            </div>
                          </div>
                        );
                      })()}
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
              ref={assignInputRef}
              type="text"
              value={message}
              onChange={(e) => handleMessageChange(e)}
              onKeyDown={(e) => handleInputKeyDown(e)}
              onBlur={handleInputBlur}
              placeholder={
                funnelState?.isActive
                  ? funnelState.questions[funnelState.currentStep].placeholder || "Type je antwoord..."
                  : "Typ je bericht hier..."
              }
              disabled={isLoading}
              className="w-full px-6 py-4 pr-14 rounded-2xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-sm"
            />
            {isMentionOpen && filteredMentions.length > 0 && (
              <div className="absolute left-6 right-6 bottom-[calc(100%+0.5rem)] z-50 rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
                {filteredMentions.map((colleague, idx) => (
                  <button
                    key={colleague.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleMentionSelect(colleague);
                    }}
                    data-mention-option="true"
                    className={cn(
                      "flex items-center gap-3 w-full px-3 py-2 text-sm",
                      idx === highlightIndex ? "bg-muted" : "hover:bg-muted/60"
                    )}
                  >
                    <img
                      src={colleague.avatar}
                      alt={colleague.name}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                    <span>{colleague.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">@{colleague.id}</span>
                  </button>
                ))}
              </div>
            )}
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
        pdfUrl={pdfPreview?.url || ""}
        filename={pdfPreview?.filename || ""}
      />
    </div>
  );
};
