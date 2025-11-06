export interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Array<{ file_id: string; filename?: string; quote?: string }>;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  threadId: string | null;
  colleagueId: string | null;
  createdAt: number;
  lastMessageAt: number;
}
