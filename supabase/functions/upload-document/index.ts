import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Upload document request received");

    // Create Supabase client with service role for admin access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const filename = formData.get('filename') as string;

    if (!file) {
      console.error("No file provided in request");
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      console.error(`Invalid file type: ${file.type}`);
      return new Response(
        JSON.stringify({ error: 'Only PDF files are allowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      console.error(`File too large: ${file.size} bytes`);
      return new Response(
        JSON.stringify({ error: 'File size exceeds 50MB limit' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use provided filename or original filename
    const uploadFilename = filename || file.name;
    
    // Validate filename (only allow specific PDF filenames for security)
    const allowedFilenames = [
      'RTK_NI-1341_v12-1114.pdf',
      'RTK_NI-1341_v12-1114-2.pdf'
    ];
    
    if (!allowedFilenames.includes(uploadFilename)) {
      console.error(`Invalid filename: ${uploadFilename}`);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid filename. Only allowed: ' + allowedFilenames.join(', ') 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Uploading file: ${uploadFilename}, size: ${file.size} bytes`);

    // Convert File to ArrayBuffer then to Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from('documents')
      .upload(uploadFilename, uint8Array, {
        contentType: 'application/pdf',
        upsert: true // Overwrite if exists
      });

    if (error) {
      console.error("Storage upload error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Upload successful:", data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        filename: uploadFilename,
        path: data.path,
        url: `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/documents/${uploadFilename}`
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in upload-document function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});