import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function verifyJWT(token: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );

    await verify(token, key);
    return true;
  } catch (error) {
    console.error("JWT verification failed");
    return false;
  }
}

// Simple hash function for question caching
function hashQuestion(question: string): string {
  return btoa(question.toLowerCase().trim()).replace(/[^a-zA-Z0-9]/g, '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT token
    const jwtSecret = Deno.env.get('JWT_SECRET');
    if (!jwtSecret) {
      console.error('JWT_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Service temporarily unavailable' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Niet geauthenticeerd' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.substring(7);
    const isValid = await verifyJWT(token, jwtSecret);
    
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Ongeldige authenticatie' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { message, threadId } = await req.json();
    
    // Validate message
    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Ongeldig berichtformaat' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmedMessage = message.trim();
    
    if (trimmedMessage.length === 0 || trimmedMessage.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Bericht moet tussen 1 en 2000 tekens bevatten' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const ASSISTANT_ID = "asst_u9SBVjdEmMgEyJtXkiOSkZMD";
    const VECTOR_STORE_ID = "vs_68ef575ffe4881918c0524c389babc60";

    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Service temporarily unavailable' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client for caching
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check cache first
    const questionHash = hashQuestion(trimmedMessage);
    console.log('Checking cache for question hash:', questionHash);
    
    const { data: cachedResponse } = await supabase
      .from('chat_responses')
      .select('*')
      .eq('question_hash', questionHash)
      .single();

    if (cachedResponse) {
      console.log('Cache hit! Returning cached response');
      
      // Increment access count
      await supabase
        .from('chat_responses')
        .update({ access_count: cachedResponse.access_count + 1 })
        .eq('id', cachedResponse.id);

      // Return cached response as SSE stream for consistent UX
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          // Send cached text as stream
          const lines = cachedResponse.answer.split(' ');
          let i = 0;
          
          const interval = setInterval(() => {
            if (i < lines.length) {
              const chunk = (i === 0 ? lines[i] : ' ' + lines[i]);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                type: 'token', 
                content: chunk 
              })}\n\n`));
              i++;
            } else {
              // Send citations
              if (cachedResponse.citations) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                  type: 'citations', 
                  citations: cachedResponse.citations 
                })}\n\n`));
              }
              controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
              controller.close();
              clearInterval(interval);
            }
          }, 30); // Simulate streaming speed
        }
      });

      return new Response(stream, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' }
      });
    }

    console.log('Cache miss. Calling OpenAI...');

    // Create or use existing thread
    let currentThreadId = threadId;
    if (!currentThreadId) {
      console.log('Creating new thread...');
      const threadResponse = await fetch('https://api.openai.com/v1/threads', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({})
      });

      if (!threadResponse.ok) {
        const error = await threadResponse.text();
        console.error('Thread creation error:', error);
        throw new Error(`Failed to create thread: ${error}`);
      }

      const threadData = await threadResponse.json();
      currentThreadId = threadData.id;
      console.log('New thread created:', currentThreadId);
    }

    // Add message to thread
    console.log('Adding message to thread...');
    const messageResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        role: 'user',
        content: trimmedMessage
      })
    });

    if (!messageResponse.ok) {
      const error = await messageResponse.text();
      console.error('Message creation error:', error);
      throw new Error(`Failed to add message: ${error}`);
    }

    console.log('Message added successfully');

    // Create run with streaming
    console.log('Creating streaming run...');
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        assistant_id: ASSISTANT_ID,
        additional_instructions: "Belangrijk: Geef je antwoord ALTIJD in het Nederlands, ongeacht de taal waarin de vraag wordt gesteld.",
        tool_resources: {
          file_search: {
            vector_store_ids: [VECTOR_STORE_ID]
          }
        },
        stream: true
      })
    });

    if (!runResponse.ok) {
      const error = await runResponse.text();
      console.error('Run creation error:', error);
      throw new Error(`Failed to create run: ${error}`);
    }

    console.log('Streaming run created');

    // Variables to store for caching
    let fullText = '';
    const citations: Array<{ file_id: string; quote?: string }> = [];

    // Stream the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const reader = runResponse.body?.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          if (!reader) {
            throw new Error('No response body');
          }

          // Send threadId first
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'thread', 
            threadId: currentThreadId 
          })}\n\n`));

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);
                  
                  // Handle delta events
                  if (parsed.event === 'thread.message.delta') {
                    const delta = parsed.data?.delta?.content?.[0];
                    if (delta?.type === 'text' && delta.text?.value) {
                      const content = delta.text.value;
                      fullText += content;
                      
                      // Forward to client
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                        type: 'token', 
                        content 
                      })}\n\n`));
                    }
                    
                    // Extract annotations for citations
                    if (delta?.text?.annotations) {
                      for (const annotation of delta.text.annotations) {
                        if (annotation.type === 'file_citation' && annotation.file_citation) {
                          citations.push({
                            file_id: annotation.file_citation.file_id,
                            quote: annotation.file_citation.quote
                          });
                        }
                      }
                    }
                  }
                  
                  // Handle completion
                  if (parsed.event === 'thread.run.completed') {
                    console.log('Run completed');
                    
                    // Clean text
                    fullText = fullText.replace(/【[^】]*】/g, '');
                    fullText = fullText.replace(/Bron:\s*[^\n]+\.txt/gi, '');
                    fullText = fullText.replace(/Bron:\s*[^\n]+/gi, '');
                    fullText = fullText.replace(/\n\s*\n\s*\n/g, '\n\n');
                    fullText = fullText.trim();

                    // Get unique citations with filenames
                    const uniqueCitations = Array.from(
                      new Map(citations.map(c => [c.file_id, c])).values()
                    );

                    const citationsWithFilenames = await Promise.all(
                      uniqueCitations.map(async (citation) => {
                        try {
                          const fileResponse = await fetch(`https://api.openai.com/v1/files/${citation.file_id}`, {
                            headers: {
                              'Authorization': `Bearer ${OPENAI_API_KEY}`,
                            }
                          });
                          const fileData = await fileResponse.json();
                          return {
                            ...citation,
                            filename: fileData.filename || citation.file_id
                          };
                        } catch (error) {
                          console.error('Error fetching file metadata:', error);
                          return { ...citation, filename: citation.file_id };
                        }
                      })
                    );

                     // Cache the response
                    console.log('Caching response...');
                    await supabase.from('chat_responses').insert({
                      question_hash: questionHash,
                      question: trimmedMessage,
                      answer: fullText,
                      citations: citationsWithFilenames
                    });

                    // Send citations to client
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                      type: 'citations', 
                      citations: citationsWithFilenames 
                    })}\n\n`));
                  }
                } catch (e) {
                  console.error('Error parsing SSE data:', e);
                }
              }
            }
          }

          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' }
    });

  } catch (error) {
    console.error('Error in openai-chat function:', error);
    return new Response(
      JSON.stringify({ error: 'Er is een fout opgetreden' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
