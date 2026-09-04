import { supabase } from '@/lib/supabase';

const PASSWORD_RESET_PATH = '/reset-password';

type RecoverySessionPayload =
  | {
      accessToken: string;
      refreshToken: string;
      type: 'session';
    }
  | {
      code: string;
      type: 'code';
    }
  | {
      tokenHash: string;
      type: 'otp';
    }
  | {
      email: string;
      token: string;
      type: 'email-otp';
    };

type RecoverySessionResult = {
  email?: string;
};

// Mobile builds this from the app's deep-link scheme. On web the reset link
// has to come back to this deployment, so it is built from the current origin.
export const passwordResetRedirectUrl = `${window.location.origin}${PASSWORD_RESET_PATH}`;

function getCombinedParams(url: string) {
  const params = new URLSearchParams();
  const parsedUrl = new URL(url);

  parsedUrl.searchParams.forEach((value, key) => {
    params.set(key, value);
  });

  const hashParams = parsedUrl.hash.startsWith('#') ? parsedUrl.hash.slice(1) : parsedUrl.hash;
  if (hashParams.length > 0) {
    new URLSearchParams(hashParams).forEach((value, key) => {
      params.set(key, value);
    });
  }

  return params;
}

function getRecoveryPayload(url: string): RecoverySessionPayload {
  const params = getCombinedParams(url);
  const errorDescription = params.get('error_description') ?? params.get('error');

  if (errorDescription) {
    throw new Error(errorDescription.replace(/\+/g, ' '));
  }

  const code = params.get('code');
  if (code) {
    return { code, type: 'code' };
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    return { accessToken, refreshToken, type: 'session' };
  }

  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  if (tokenHash && type === 'recovery') {
    return { tokenHash, type: 'otp' };
  }

  const email = params.get('email');
  const token = params.get('token');
  if (email && token && type === 'recovery') {
    return { email, token, type: 'email-otp' };
  }

  throw new Error('This reset link is missing its recovery token. Request a new email and try again.');
}

export async function createRecoverySessionFromUrl(url: string): Promise<RecoverySessionResult> {
  const payload = getRecoveryPayload(url);

  if (payload.type === 'code') {
    const { data, error } = await supabase.auth.exchangeCodeForSession(payload.code);

    if (error) {
      throw error;
    }

    return { email: data.session?.user.email };
  }

  if (payload.type === 'session') {
    const { data, error } = await supabase.auth.setSession({
      access_token: payload.accessToken,
      refresh_token: payload.refreshToken,
    });

    if (error) {
      throw error;
    }

    return { email: data.session?.user.email };
  }

  const { data, error } =
    payload.type === 'otp'
      ? await supabase.auth.verifyOtp({
          token_hash: payload.tokenHash,
          type: 'recovery',
        })
      : await supabase.auth.verifyOtp({
          email: payload.email,
          token: payload.token,
          type: 'recovery',
        });

  if (error) {
    throw error;
  }

  return { email: data.session?.user.email };
}
