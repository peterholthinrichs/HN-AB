import { Plus, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import engineerAvatar from "@/assets/engineer-avatar.png";

interface Colleague {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  messageCount: number;
}

const colleagues: Colleague[] = [
  { id: "1", name: "Engineer", role: "Calculator", messageCount: 3, avatar: engineerAvatar },
  { id: "2", name: "Henk", role: "Uitvoerder", messageCount: 5 },
  { id: "3", name: "Monique", role: "Marketing", messageCount: 16 },
];

export const ChatSidebar = () => {
  return (
    <aside className="w-[var(--sidebar-width)] h-screen bg-secondary border-r border-border flex flex-col">
      {/* New Chat Button */}
      <div className="p-4">
        <Button className="w-full justify-start gap-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium">
          <div className="w-6 h-6 rounded-full bg-primary-foreground/20 flex items-center justify-center">
            <Plus className="w-4 h-4" />
          </div>
          Nieuwe chat
        </Button>
      </div>

      {/* Colleagues Section */}
      <div className="flex-1 px-4 overflow-y-auto">
        <h3 className="text-sm font-medium text-foreground mb-3">Collega's</h3>
        <div className="space-y-1">
          {colleagues.map((colleague) => (
            <button
              key={colleague.id}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
            >
              <Avatar className="w-10 h-10">
                <AvatarImage src={colleague.avatar} />
                <AvatarFallback className="bg-muted text-foreground">
                  {colleague.name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground text-sm">
                    {colleague.name}
                  </span>
                  <span className="text-muted-foreground text-sm">·</span>
                  <span className="text-muted-foreground text-sm">
                    {colleague.role}
                  </span>
                </div>
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                {colleague.messageCount}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Footer Branding */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-accent-foreground font-bold text-sm">PT</span>
          </div>
          <span className="font-medium text-foreground text-sm">
            POOL techniek
          </span>
          <Button variant="ghost" size="icon" className="ml-auto">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
};
