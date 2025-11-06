import { useState, useEffect } from "react";
import { ChatSidebar, colleagues } from "@/components/ChatSidebar";
import { ChatWelcome } from "@/components/ChatWelcome";
import { ChatSession, Message } from "@/types/chat";

const STORAGE_KEY = "engineer-chat-sessions";
const COLLEAGUE_NAMES: Record<string, string> = Object.fromEntries(
  colleagues.map((colleague) => [colleague.id, colleague.name])
);

const Index = () => {
  const defaultColleague = colleagues[0]?.id ?? null;
  const [selectedColleague, setSelectedColleague] = useState<string | null>(
    defaultColleague
  );
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // Load sessions from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        const sessions: ChatSession[] = (data.sessions || []).map((session: any) => ({
          ...session,
          colleagueId: session.colleagueId ?? null,
        }));

        setChatSessions(sessions);

        const lastActiveId = data.lastActive || sessions[0]?.id || null;
        setActiveChatId(lastActiveId);

        const lastActiveSession = sessions.find((session) => session.id === lastActiveId);
        if (lastActiveSession?.colleagueId) {
          setSelectedColleague(lastActiveSession.colleagueId);
        }
      } catch (error) {
        console.error("Failed to load chat sessions:", error);
      }
    } else {
      const initialSession: ChatSession = {
        id: `chat-${Date.now()}`,
        title: defaultColleague
          ? `Nieuwe chat met ${COLLEAGUE_NAMES[defaultColleague] ?? defaultColleague}`
          : "Nieuwe chat",
        messages: [],
        threadId: null,
        colleagueId: defaultColleague,
        createdAt: Date.now(),
        lastMessageAt: Date.now(),
      };
      setChatSessions([initialSession]);
      setActiveChatId(initialSession.id);
    }
  }, [defaultColleague]);

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

  const handleNewChat = (colleagueId: string | null = selectedColleague) => {
    if (colleagueId) {
      setSelectedColleague(colleagueId);
    }

    const newSession: ChatSession = {
      id: `chat-${Date.now()}`,
      title: colleagueId
        ? `Nieuwe chat met ${COLLEAGUE_NAMES[colleagueId] ?? colleagueId}`
        : "Nieuwe chat",
      messages: [],
      threadId: null,
      colleagueId: colleagueId || null,
      createdAt: Date.now(),
      lastMessageAt: Date.now(),
    };

    setChatSessions((prev) => [newSession, ...prev].slice(0, 50));
    setActiveChatId(newSession.id);
  };

  const handleSelectColleague = (colleagueId: string) => {
    setSelectedColleague(colleagueId);
    const existingSession = chatSessions.find((session) => session.colleagueId === colleagueId);

    if (existingSession) {
      setActiveChatId(existingSession.id);
    } else {
      handleNewChat(colleagueId);
    }
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
        setSelectedColleague(remainingSessions[0].colleagueId);
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
          colleagueId: selectedColleague,
          createdAt: Date.now(),
          lastMessageAt: Date.now(),
        };

        return [newSession, ...prev].slice(0, 50);
      }

      // Update existing session
      const updatedSessions = [...prev];
      const existingSession = updatedSessions[sessionIndex];
      const firstUserMessage = messages.find((m) => m.role === "user");
      const title = firstUserMessage
        ? firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? "..." : "")
        : existingSession.title;

      updatedSessions[sessionIndex] = {
        ...existingSession,
        title,
        messages,
        threadId,
        colleagueId: existingSession.colleagueId ?? selectedColleague ?? null,
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
        onSelectColleague={handleSelectColleague}
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
