-- Create chat_responses table for caching
CREATE TABLE IF NOT EXISTS public.chat_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_hash TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  citations JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  access_count INTEGER DEFAULT 1
);

-- Create index for fast lookups
CREATE INDEX idx_chat_responses_question_hash ON public.chat_responses(question_hash);
CREATE INDEX idx_chat_responses_created_at ON public.chat_responses(created_at DESC);

-- Enable RLS
ALTER TABLE public.chat_responses ENABLE ROW LEVEL SECURITY;

-- Allow public read access (since this is a public chatbot)
CREATE POLICY "Allow public read access to chat responses"
ON public.chat_responses
FOR SELECT
USING (true);

-- Allow public insert access (for caching new responses)
CREATE POLICY "Allow public insert access to chat responses"
ON public.chat_responses
FOR INSERT
WITH CHECK (true);

-- Allow public update access (for incrementing access_count)
CREATE POLICY "Allow public update access to chat responses"
ON public.chat_responses
FOR UPDATE
USING (true);