import { Plus, MoreVertical, ChevronDown, ChevronRight, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import engineerAvatar from "@/assets/engineer-avatar.png";
import henkAvatar from "@/assets/henk-avatar.png";
import hrAvatar from "@/assets/hr-avatar.png";
import { ChatSession } from "@/types/chat";
import { useState } from "react";

interface Colleague {
  id: string;
  name: string;
  role: string;
  avatar?: string;
}

const colleagues: Colleague[] = [
  { id: "1", name: "Engineer", role: "Holiday ICE", avatar: engineerAvatar },
  { id: "2", name: "Marketing", role: "LOCKED", avatar: henkAvatar },
  { id: "3", name: "HR", role: "LOCKED", avatar: hrAvatar },
];

interface ChatSidebarProps {
  selectedColleague: string | null;
  onSelectColleague: (id: string) => void;
  onNewChat?: () => void;
  chatSessions: ChatSession[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
}

export const ChatSidebar = ({ 
  selectedColleague, 
  onSelectColleague, 
  onNewChat, 
  chatSessions, 
  activeChatId, 
  onSelectChat 
}: ChatSidebarProps) => {
  const [isEngineerExpanded, setIsEngineerExpanded] = useState(true);

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Nu";
    if (minutes < 60) return `${minutes} min geleden`;
    if (hours < 24) return `${hours} uur geleden`;
    if (days === 1) return "Gisteren";
    if (days < 7) return `${days} dagen geleden`;
    return new Date(timestamp).toLocaleDateString("nl-NL");
  };
  return (
    <aside className="w-[var(--sidebar-width)] h-screen bg-secondary border-r border-border flex flex-col">
      {/* New Chat Button */}
      <div className="p-4">
        <Button 
          onClick={onNewChat}
          className="w-full justify-start gap-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
        >
          <div className="w-6 h-6 rounded-full bg-primary-foreground/20 flex items-center justify-center">
            <Plus className="w-4 h-4" />
          </div>
          Nieuwe chat
        </Button>
      </div>

      {/* Colleagues Section */}
      <div className="flex-1 px-4 overflow-hidden flex flex-col">
        <h3 className="text-sm font-medium text-foreground mb-3">Collega's</h3>
        <ScrollArea className="flex-1">
          <div className="space-y-1 pr-4">
            {colleagues.map((colleague) => {
              const isLocked = colleague.role === "LOCKED";
              const isEngineer = colleague.id === "1";
              const engineerChats = isEngineer ? chatSessions : [];

              return (
                <div key={colleague.id}>
                  {/* Colleague Header */}
                  <button
                    onClick={() => {
                      if (!isLocked) {
                        if (isEngineer) {
                          setIsEngineerExpanded(!isEngineerExpanded);
                        }
                        onSelectColleague(colleague.id);
                      }
                    }}
                    disabled={isLocked}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left ${
                      isLocked ? "opacity-60 cursor-not-allowed" : "hover:bg-muted/50 cursor-pointer"
                    }`}
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={colleague.avatar} />
                      <AvatarFallback className="bg-muted text-foreground">{colleague.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground text-sm">{colleague.name}</span>
                        {isEngineer && engineerChats.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {engineerChats.length}
                          </Badge>
                        )}
                      </div>
                      <span className="text-muted-foreground text-xs">{colleague.role}</span>
                    </div>
                    {isEngineer && engineerChats.length > 0 && (
                      <div className="text-muted-foreground">
                        {isEngineerExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </div>
                    )}
                  </button>

                  {/* Engineer Chat Sessions */}
                  {isEngineer && isEngineerExpanded && engineerChats.length > 0 && (
                    <div className="ml-4 mt-1 space-y-1">
                      {engineerChats.slice(0, 15).map((session) => (
                        <button
                          key={session.id}
                          onClick={() => onSelectChat(session.id)}
                          className={`w-full flex items-start gap-2 p-2 rounded-lg transition-colors text-left ${
                            activeChatId === session.id
                              ? "bg-primary/10 border border-primary"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-foreground line-clamp-2 break-words">
                              {session.title}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatTimestamp(session.lastMessageAt)}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Footer Branding */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-accent-foreground font-bold text-sm">PT</span>
          </div>
          <span className="font-medium text-foreground text-sm">POOL techniek</span>
          <Button variant="ghost" size="icon" className="ml-auto">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
};
