import { useState, useEffect } from "react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatWelcome } from "@/components/ChatWelcome";
import { ChatSession, Message } from "@/types/chat";

const STORAGE_KEY = "engineer-chat-sessions";

const Index = () => {
  const [selectedColleague, setSelectedColleague] = useState<string | null>("1");
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // Load sessions from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setChatSessions(data.sessions || []);
        setActiveChatId(data.lastActive || null);
      } catch (error) {
        console.error("Failed to load chat sessions:", error);
      }
    }
  }, []);

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    if (chatSessions.length > 0 || activeChatId) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          sessions: chatSessions,
          lastActive: activeChatId,
        })
      );
    }
  }, [chatSessions, activeChatId]);

  const handleNewChat = () => {
    // Save current chat if it has messages
    const currentSession = chatSessions.find((s) => s.id === activeChatId);
    if (currentSession && currentSession.messages.length > 0) {
      // Current chat already saved, just create new one
    }

    // Create new chat session
    const newSession: ChatSession = {
      id: `chat-${Date.now()}`,
      title: "Nieuwe chat",
      messages: [],
      threadId: null,
      createdAt: Date.now(),
      lastMessageAt: Date.now(),
    };

    setChatSessions((prev) => [newSession, ...prev].slice(0, 50)); // Keep max 50 chats
    setActiveChatId(newSession.id);
  };

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
  };

  const handleSessionUpdate = (messages: Message[], threadId: string | null) => {
    if (!activeChatId) return;

    setChatSessions((prev) => {
      const sessionIndex = prev.findIndex((s) => s.id === activeChatId);
      
      if (sessionIndex === -1) {
        // Create new session if not found
        const firstUserMessage = messages.find((m) => m.role === "user");
        const title = firstUserMessage
          ? firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? "..." : "")
          : "Nieuwe chat";

        const newSession: ChatSession = {
          id: activeChatId,
          title,
          messages,
          threadId,
          createdAt: Date.now(),
          lastMessageAt: Date.now(),
        };

        return [newSession, ...prev].slice(0, 50);
      }

      // Update existing session
      const updatedSessions = [...prev];
      const firstUserMessage = messages.find((m) => m.role === "user");
      const title = firstUserMessage
        ? firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? "..." : "")
        : updatedSessions[sessionIndex].title;

      updatedSessions[sessionIndex] = {
        ...updatedSessions[sessionIndex],
        title,
        messages,
        threadId,
        lastMessageAt: Date.now(),
      };

      return updatedSessions;
    });
  };

  const currentSession = chatSessions.find((s) => s.id === activeChatId) || null;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <ChatSidebar
        selectedColleague={selectedColleague}
        onSelectColleague={setSelectedColleague}
        onNewChat={handleNewChat}
        chatSessions={chatSessions}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        <ChatWelcome currentSession={currentSession} onSessionUpdate={handleSessionUpdate} />
      </main>
    </div>
  );
};

export default Index;
