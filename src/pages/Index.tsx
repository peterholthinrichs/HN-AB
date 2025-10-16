import { useState, useEffect } from "react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatWelcome } from "@/components/ChatWelcome";
import { ChatSession, Message } from "@/types/chat";

const STORAGE_KEY = "engineer-chat-sessions";

const Index = () => {
  const [selectedColleague, setSelectedColleague] = useState<string | null>("1");
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

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
    
    // If no active chat after loading, create initial empty session
    if (!stored || !localStorage.getItem(STORAGE_KEY)) {
      const initialSession: ChatSession = {
        id: `chat-${Date.now()}`,
        title: "Nieuwe chat",
        messages: [],
        threadId: null,
        createdAt: Date.now(),
        lastMessageAt: Date.now(),
      };
      setChatSessions([initialSession]);
      setActiveChatId(initialSession.id);
    }
    
    setIsInitialized(true);
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
    // Get the current session (might have unsaved messages)
    const currentSessionData = chatSessions.find((s) => s.id === activeChatId);
    
    // If current session exists and has messages, ensure it's saved
    if (currentSessionData && currentSessionData.messages.length > 0) {
      // Session is already in chatSessions, it will be automatically saved via useEffect
      // No action needed here
    } else if (activeChatId) {
      // There might be an active chat ID but no session saved yet
      // This happens when the first message is sent but session hasn't been created yet
      // The handleSessionUpdate will handle this, so we just need to make sure
      // we're not creating a duplicate
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

  const handleDeleteChat = (chatId: string) => {
    setChatSessions((prev) => prev.filter((s) => s.id !== chatId));
    
    if (activeChatId === chatId) {
      const remainingSessions = chatSessions.filter((s) => s.id !== chatId);
      if (remainingSessions.length > 0) {
        setActiveChatId(remainingSessions[0].id);
      } else {
        handleNewChat();
      }
    }
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
        onDeleteChat={handleDeleteChat}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        <ChatWelcome currentSession={currentSession} onSessionUpdate={handleSessionUpdate} />
      </main>
    </div>
  );
};

export default Index;
