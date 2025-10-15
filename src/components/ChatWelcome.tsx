import { MessageSquare, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const suggestions = [
  "Zoek in het prijzenboek het meest passende onderdeel bij de omschrijving van het werk.",
  "Maak een berekening voor meerdere onderhoudsscenario's",
  "Bereken de Total Cost of Ownership voor een onderhoudsmaatregel.",
];

export const ChatWelcome = () => {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (message.trim()) {
      console.log("Sending message:", message);
      // Handle message sending here
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-4xl mx-auto w-full">
      {/* Welcome Icon */}
      <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center mb-6">
        <span className="text-3xl">😊</span>
      </div>

      {/* Welcome Text */}
      <h1 className="text-3xl font-semibold text-foreground mb-12">
        Waar kan ik je mee helpen?
      </h1>

      {/* Message Input */}
      <div className="w-full max-w-2xl mb-8">
        <div className="relative">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ik moet een offerte maken voor Hof Wonen voor het aanbrengen van 50m2 gevel"
            className="w-full px-6 py-4 pr-14 rounded-2xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-sm"
          />
          <Button
            size="icon"
            onClick={handleSend}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-foreground hover:bg-foreground/90 text-background"
          >
            <ArrowUp className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Suggestions */}
      <div className="w-full max-w-2xl space-y-3">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => setMessage(suggestion)}
            className="w-full flex items-start gap-3 p-4 rounded-xl bg-card border border-border hover:bg-muted/30 transition-colors text-left group"
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
};
