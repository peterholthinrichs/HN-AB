import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, threadId, runId } = await req.json();
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const ASSISTANT_ID = "asst_u9SBVjdEmMgEyJtXkiOSkZMD";
    const VECTOR_STORE_ID = "vs_68ef575ffe4881918c0524c389babc60";

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Check run status if runId provided
    if (runId && threadId) {
      console.log('Checking run status:', runId);
      const statusResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });

      const runStatus = await statusResponse.json();
      console.log('Run status:', runStatus.status);

      if (runStatus.status === 'completed') {
        // Fetch messages
        const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages?limit=1&order=desc`, {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        });

        const messagesData = await messagesResponse.json();
        const lastMessage = messagesData.data[0];
        
        let text = '';
        const citations: Array<{ file_id: string; quote?: string }> = [];
        
        if (lastMessage?.role === 'assistant' && lastMessage.content) {
          for (const content of lastMessage.content) {
            if (content.type === 'text' && content.text?.value) {
              text += content.text.value;
              
              // Extract citations from annotations
              if (content.text?.annotations) {
                for (const annotation of content.text.annotations) {
                  if (annotation.type === 'file_citation' && annotation.file_citation) {
                    citations.push({
                      file_id: annotation.file_citation.file_id,
                      quote: annotation.file_citation.quote
                    });
                  }
                }
              }
            }
          }
        }

        // Fetch file metadata for each citation to get filenames
        const citationsWithFilenames = await Promise.all(
          citations.map(async (citation) => {
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

        return new Response(JSON.stringify({ 
          status: 'completed', 
          text,
          citations: citationsWithFilenames
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else if (runStatus.status === 'failed' || runStatus.status === 'cancelled' || runStatus.status === 'expired') {
        return new Response(JSON.stringify({ 
          status: runStatus.status,
          error: runStatus.last_error?.message || 'Run failed'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        // Still in progress
        return new Response(JSON.stringify({ 
          status: runStatus.status 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

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
        content: message
      })
    });

    if (!messageResponse.ok) {
      const error = await messageResponse.text();
      console.error('Message creation error:', error);
      throw new Error(`Failed to add message: ${error}`);
    }

    console.log('Message added successfully');

    // Create run
    console.log('Creating run...');
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
        }
      })
    });

    if (!runResponse.ok) {
      const error = await runResponse.text();
      console.error('Run creation error:', error);
      throw new Error(`Failed to create run: ${error}`);
    }

    const runData = await runResponse.json();
    console.log('Run created:', runData.id);

    return new Response(JSON.stringify({
      threadId: currentThreadId,
      runId: runData.id,
      status: 'in_progress'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in openai-chat function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
