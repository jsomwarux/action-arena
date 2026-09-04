import { supabase } from '@/lib/supabase';

const PASSWORD_RESET_PATH = '/reset-password';

/**
 * Who owns the recovery URL: supabase-js does.
 * ============================================
 *
 * `detectSessionInUrl` stays `true` on the browser client (src/lib/supabase.ts),
 * so during client initialisation auth-js consumes every recovery payload it is
 * able to redeem itself, and rewrites the address bar on the way out:
 *
 *   - implicit grant — `#access_token=…&refresh_token=…&type=recovery`
 *     → session saved, `PASSWORD_RECOVERY` emitted, `location.hash` cleared.
 *   - PKCE — `?code=…`, but only when a matching code verifier is in storage
 *     → exchanged, `code` stripped from the query string.
 *
 * That is why the ported mobile parser could not stay: it re-read the same
 * parameters from a page that mounts *after* initialisation, found an empty
 * hash, and reported a missing token on a link that had already worked. The
 * reset page now reads the resulting session instead of parsing anything.
 *
 * This module keeps only the two jobs auth-js deliberately leaves alone, so
 * nothing here competes for a parameter auth-js has claimed:
 *
 *   1. `readRecoveryLinkError` — `_getSessionFromURL` throws on `error` /
 *      `error_code` / `error_description` *before* it rewrites the URL, so an
 *      expired or already-used link still carries them. Without this the page
 *      would sit on an empty form with no explanation.
 *   2. `readManualRecoveryPayload` / `redeemRecoveryPayload` — the shapes
 *      auto-detection never claims: `?token_hash=…&type=recovery` from a custom
 *      email template, `?email=…&token=…&type=recovery` for an emailed OTP, and
 *      a `?code=…` that no stored verifier matched. The reset page only calls
 *      these once initialisation has finished and produced no session, so they
 *      can never race auto-detection for the same parameters.
 *
 * Turning `detectSessionInUrl` off would have restored the mobile parser
 * verbatim, and this project could technically afford it — its Supabase auth
 * settings report `mailer_autoconfirm: true`, i.e. no signup confirmation
 * email exists to break. It is still the wrong trade: it would hand-roll
 * behaviour the browser client already gets right, and it would quietly break
 * the next emailed auth link anyone adds (email-change confirmation, magic
 * link, invite) with no failure visible at the call site.
 */

type ManualRecoveryPayload =
  | { code: string; type: 'code' }
  | { email: string; token: string; type: 'email-otp' }
  | { tokenHash: string; type: 'otp' };

export type { ManualRecoveryPayload };

export type RecoverySessionResult = {
  email?: string;
};

// Mobile builds this from the app's deep-link scheme. On web the reset link has
// to come back to this deployment, so it is built from the current origin.
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

/**
 * The failure GoTrue reports on the redirect itself — an expired link, a link
 * that was already spent, a revoked token. Returns undefined for a clean URL.
 */
export function readRecoveryLinkError(url: string): string | undefined {
  const params = getCombinedParams(url);
  const description = params.get('error_description') ?? params.get('error');

  if (!description) {
    return undefined;
  }

  return description.replace(/\+/g, ' ');
}

/**
 * A recovery payload this app still has to redeem by hand, or null when there
 * is nothing left in the URL for us — which is the normal case, because
 * auto-detection has already taken it.
 *
 * `code` is checked last: it is auth-js's parameter first, and ours only when
 * initialisation finished without a session to show for it.
 */
export function readManualRecoveryPayload(url: string): ManualRecoveryPayload | null {
  const params = getCombinedParams(url);
  const type = params.get('type');

  const tokenHash = params.get('token_hash');
  if (tokenHash && type === 'recovery') {
    return { tokenHash, type: 'otp' };
  }

  const email = params.get('email');
  const token = params.get('token');
  if (email && token && type === 'recovery') {
    return { email, token, type: 'email-otp' };
  }

  const code = params.get('code');
  if (code) {
    return { code, type: 'code' };
  }

  return null;
}

export async function redeemRecoveryPayload(
  payload: ManualRecoveryPayload,
): Promise<RecoverySessionResult> {
  if (payload.type === 'code') {
    const { data, error } = await supabase.auth.exchangeCodeForSession(payload.code);

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
