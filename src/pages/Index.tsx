import { useState } from "react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatWelcome } from "@/components/ChatWelcome";

const Index = () => {
  const [selectedColleague, setSelectedColleague] = useState<string | null>("1");

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <ChatSidebar 
        selectedColleague={selectedColleague}
        onSelectColleague={setSelectedColleague}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        <ChatWelcome />
      </main>
    </div>
  );
};

export default Index;
