import { Plus, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "react-router-dom";
import claireAvatar from "@/assets/claire.jpg";
import tomAvatar from "@/assets/tom.jpg";
import remcoAvatar from "@/assets/remco.jpg";
import poolLogo from "/hn-ab-logo.svg";
import uploadIcon from "@/assets/upload-icon.png";
import { ChatSession } from "@/types/chat";

interface Colleague {
  id: string;
  name: string;
  avatar: string;
}

export const colleagues: Colleague[] = [
  { id: "claire", name: "Claire", avatar: claireAvatar },
  { id: "tom", name: "Tom", avatar: tomAvatar },
  { id: "remco", name: "Remco", avatar: remcoAvatar },
];

interface ChatSidebarProps {
  selectedColleague: string | null;
  onSelectColleague: (id: string) => void;
  onNewChat?: (colleagueId: string | null) => void;
  chatSessions: ChatSession[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
}

export const ChatSidebar = ({ 
  selectedColleague, 
  onSelectColleague, 
  onNewChat, 
  chatSessions, 
  activeChatId, 
  onSelectChat,
  onDeleteChat
}: ChatSidebarProps) => {
  const filteredSessions = selectedColleague
    ? chatSessions.filter((session) => session.colleagueId === selectedColleague)
    : chatSessions;

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
          onClick={() => onNewChat?.(selectedColleague)}
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
        <div className="space-y-2 mb-4">
          {colleagues.map((colleague) => {
            const isSelected = selectedColleague === colleague.id;

            return (
              <button
                key={colleague.id}
                onClick={() => onSelectColleague(colleague.id)}
                className={`relative w-full flex items-center gap-3 rounded-2xl border border-transparent bg-card px-5 py-3 text-left transition-all shadow-sm ${
                  isSelected
                    ? "border-amber-300/80 shadow-md bg-card"
                    : "hover:border-amber-200 hover:shadow-md"
                }`}
              >
                {isSelected && (
                  <span className="absolute left-0 top-1/2 h-10 w-1 -translate-y-1/2 rounded-full bg-amber-400"></span>
                )}
                <Avatar className="w-12 h-12">
                  <AvatarImage src={colleague.avatar} />
                  <AvatarFallback className="bg-muted text-foreground">
                    {colleague.name[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground text-sm">{colleague.name}</span>
              </button>
            );
          })}
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-1 pr-4 pb-4">
            {filteredSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Geen recente chats. Start een gesprek door op een collega te klikken.
              </p>
            ) : (
              filteredSessions.slice(0, 15).map((session) => (
                <button
                  key={session.id}
                  onClick={() => onSelectChat(session.id)}
                  className={`w-full flex items-start gap-2 p-2 rounded-lg transition-colors text-left group ${
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
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteChat(session.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        onDeleteChat(session.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive flex-shrink-0 cursor-pointer"
                    aria-label="Chat verwijderen"
                  >
                    <X className="w-4 h-4" />
                  </span>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Footer Branding */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-lg overflow-hidden flex items-center justify-center bg-white">
            <img src={poolLogo} alt="HN-AB logo" className="w-full h-full object-contain" />
          </div>
          <span className="font-medium text-foreground text-sm">HN-AB</span>
          <Link to="/admin/upload" className="ml-auto">
            <img src={uploadIcon} alt="Upload" className="w-6 h-6 object-contain hover:opacity-70 transition-opacity cursor-pointer" />
          </Link>
        </div>
      </div>
    </aside>
  );
};
