import { createClient } from 'jsr:@supabase/supabase-js@2';

type DeleteAccountDatabase = {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: Record<string, never>;
    Tables: Record<string, never>;
    Views: Record<string, never>;
  };
};

const jsonHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

function bearerToken(request: Request) {
  const header = request.headers.get('Authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    headers: jsonHeaders,
    status,
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: jsonHeaders,
      status: 204,
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed', ok: false }, 405);
  }

  try {
    const token = bearerToken(request);

    if (!token) {
      return jsonResponse({ error: 'Authentication required', ok: false }, 401);
    }

    const supabase = createClient<DeleteAccountDatabase>(
      getRequiredEnv('SUPABASE_URL'),
      getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse({ error: 'Invalid or expired session', ok: false }, 401);
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    return jsonResponse({ deletedUserId: user.id, ok: true }, 200);
  } catch (error) {
    const message = errorMessage(error);
    console.error('Account deletion failed', { message });
    return jsonResponse({ error: message, ok: false }, 500);
  }
});
