import { useState } from "react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatWelcome } from "@/components/ChatWelcome";

const Index = () => {
  const [selectedColleague, setSelectedColleague] = useState<string | null>("1");
  const [chatKey, setChatKey] = useState(0);

  const handleNewChat = () => {
    // Force remount of ChatWelcome by changing key
    setChatKey(prev => prev + 1);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <ChatSidebar 
        selectedColleague={selectedColleague}
        onSelectColleague={setSelectedColleague}
        onNewChat={handleNewChat}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        <ChatWelcome key={chatKey} />
      </main>
    </div>
  );
};

export default Index;
