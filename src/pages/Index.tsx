import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatWelcome } from "@/components/ChatWelcome";

const Index = () => {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <ChatSidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <ChatWelcome />
      </main>
    </div>
  );
};

export default Index;
