import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UploadRequest {
  filename: string;
  fileBase64: string;
  vectorStoreId: string;
}

async function verifyJWT(token: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const [headerB64, payloadB64, signatureB64] = token.split('.');
    const data = encoder.encode(`${headerB64}.${payloadB64}`);
    
    const signatureBytes = Uint8Array.from(atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    
    const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, data);
    
    if (!isValid) return false;

    const payload = JSON.parse(atob(payloadB64));
    const now = Math.floor(Date.now() / 1000);
    
    if (payload.exp && payload.exp < now) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('JWT verification error:', error);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const jwtSecret = Deno.env.get('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.substring(7);
    const isValid = await verifyJWT(token, jwtSecret);
    
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: UploadRequest = await req.json();
    const { filename, fileBase64, vectorStoreId } = body;

    if (!filename || !fileBase64 || !vectorStoreId) {
      return new Response(
        JSON.stringify({ error: 'Missing filename, fileBase64 or vectorStoreId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file extension
    if (!filename.toLowerCase().endsWith('.pdf')) {
      return new Response(
        JSON.stringify({ error: 'Only PDF files are allowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decode base64 to Uint8Array
    const binaryString = atob(fileBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Check file size (max 25MB)
    const maxSize = 25 * 1024 * 1024; // 25MB in bytes
    if (bytes.length > maxSize) {
      return new Response(
        JSON.stringify({ error: 'File size exceeds 25MB limit' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filename, bytes, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: `Upload failed: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upload file to OpenAI
    const fileBlob = new Blob([bytes], { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', fileBlob, filename);
    formData.append('purpose', 'assistants');

    const openAiUploadResponse = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: formData,
    });

    if (!openAiUploadResponse.ok) {
      const errorText = await openAiUploadResponse.text().catch(() => '');
      console.error('OpenAI file upload failed:', errorText);
      return new Response(
        JSON.stringify({ error: 'OpenAI file upload failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openAiFileData = await openAiUploadResponse.json();
    const fileId = openAiFileData?.id;

    if (!fileId) {
      console.error('OpenAI file upload missing id:', openAiFileData);
      return new Response(
        JSON.stringify({ error: 'OpenAI file upload did not return file id' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Attach file to vector store
    const attachResponse = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file_id: fileId }),
    });

    if (!attachResponse.ok) {
      const errorText = await attachResponse.text().catch(() => '');
      console.error('Failed to attach file to vector store:', errorText);
      return new Response(
        JSON.stringify({ error: 'OpenAI vector store attachment failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, filename, fileId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Server error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
