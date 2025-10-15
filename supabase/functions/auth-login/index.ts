import { create, verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LoginRequest {
  username: string;
  password: string;
}

async function generateJWT(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );

  const payload = {
    authenticated: true,
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
    iat: Math.floor(Date.now() / 1000),
  };

  const jwt = await create({ alg: "HS256", typ: "JWT" }, payload, key);
  return jwt;
}

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
    console.error("JWT verification failed:", error);
    return false;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const jwtSecret = Deno.env.get('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const url = new URL(req.url);
    
    // Verify endpoint
    if (url.pathname.endsWith('/verify')) {
      const authHeader = req.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ valid: false, error: 'No token provided' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const token = authHeader.substring(7);
      const isValid = await verifyJWT(token, jwtSecret);

      return new Response(
        JSON.stringify({ valid: isValid }),
        { 
          status: isValid ? 200 : 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Login endpoint
    const { username, password }: LoginRequest = await req.json();

    console.log('Login attempt for username:', username);

    const validUsername = Deno.env.get('AUTH_USERNAME');
    const validPassword = Deno.env.get('AUTH_PASSWORD');

    if (!validUsername || !validPassword) {
      console.error('AUTH credentials not configured');
      throw new Error('Authentication not properly configured');
    }

    // Debug logging (without exposing actual values)
    console.log('Username match:', username === validUsername);
    console.log('Password length received:', password.length);
    console.log('Expected password length:', validPassword.length);
    console.log('Password match:', password === validPassword);

    // Validate credentials
    if (username === validUsername && password === validPassword) {
      const token = await generateJWT(jwtSecret);
      
      console.log('Login successful for:', username);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          token,
          message: 'Login successful' 
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else {
      console.log('Invalid credentials for username:', username);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Ongeldige gebruikersnaam of wachtwoord' 
        }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
  } catch (error) {
    console.error('Error in auth-login:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Er is een fout opgetreden';
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
