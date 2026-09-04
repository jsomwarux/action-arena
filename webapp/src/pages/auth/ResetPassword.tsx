import { useEffect, useRef, useState, type FormEvent } from 'react';

import { Link, useNavigate } from 'react-router-dom';

import { AuthPanel } from '@/components/auth/AuthPanel';
import { Button, Notice, TextInput } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { readManualRecoveryPayload, readRecoveryLinkError } from '@/lib/auth-redirects';
import { ROUTES } from '@/lib/routes';

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Unable to reset your password. Please request a new link and try again.';
}

/**
 * Port of app/(auth)/reset-password.tsx.
 *
 * The one real difference from mobile: this screen does not parse the recovery
 * URL on the happy path. supabase-js owns it — `detectSessionInUrl` consumes an
 * implicit `#access_token` fragment or a verifier-backed `?code=` during client
 * init and clears them, so by the time this mounts there is a session, not a
 * token. See the ownership note in lib/auth-redirects.ts.
 *
 * What is still read from the URL is only what auth-js leaves behind: the
 * `error_description` of a dead link (it throws before rewriting anything), and
 * the payload shapes auto-detection never claims. Both reads happen once, at
 * first render, and the redeem attempt is gated on initialisation having
 * finished without producing a session — so the two sides never contend.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { completePasswordReset, isLoading, redeemRecoveryLink, session } = useAuth();

  const [linkError, setLinkError] = useState<string | undefined>(() =>
    readRecoveryLinkError(window.location.href),
  );
  const [payload] = useState(() => readManualRecoveryPayload(window.location.href));
  const redeemStartedRef = useRef(false);

  const [email, setEmail] = useState(session?.user.email);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (session) {
      setEmail(session.user.email);
    }
  }, [session]);

  useEffect(() => {
    // Only the leftovers, and only once the client has finished its own attempt.
    if (isLoading || session || linkError || !payload || redeemStartedRef.current) {
      return;
    }

    redeemStartedRef.current = true;
    setIsRedeeming(true);

    redeemRecoveryLink(payload)
      .then((result) => {
        setEmail(result.email);
        setNotice('Recovery confirmed. Choose a new password to finish.');
      })
      .catch((recoveryError) => {
        setLinkError(getErrorMessage(recoveryError));
      })
      .finally(() => {
        setIsRedeeming(false);
      });
  }, [isLoading, linkError, payload, redeemRecoveryLink, session]);

  const handleCompleteReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);
    setNotice(undefined);

    if (password.length < 6) {
      setError('Use a password with at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('The password fields need to match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await completePasswordReset(password);
      navigate(ROUTES.home, { replace: true });
    } catch (resetError) {
      setError(getErrorMessage(resetError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isRecovering = isLoading || isRedeeming;
  const canSubmit = Boolean(session) && !isRecovering && !linkError;

  return (
    <AuthPanel
      eyebrow="RESET · PASSWORD"
      kicker="Account Recovery"
      tagline="Lock in new credentials and get back to the board."
      title="New Password">
      <form className="flex flex-col gap-5" noValidate onSubmit={handleCompleteReset}>
        {email && !linkError ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-white/45">Resetting</p>
            <p className="mt-1 text-sm font-semibold text-white">{email}</p>
          </div>
        ) : null}

        <TextInput
          autoCapitalize="none"
          autoComplete="new-password"
          disabled={!canSubmit}
          label="New password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 6 characters"
          showPasswordToggle
          value={password}
        />
        <TextInput
          autoCapitalize="none"
          autoComplete="new-password"
          disabled={!canSubmit}
          label="Confirm password"
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Repeat new password"
          showPasswordToggle
          value={confirmPassword}
        />

        {error ? <Notice tone="error">{error}</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}

        {linkError ? (
          <Notice tone="error">
            <span className="block font-black uppercase tracking-[0.12em]">Link no longer valid</span>
            <span className="mt-1 block">{linkError}</span>
            <span className="mt-1 block font-normal text-coral-red/80">
              Reset links expire and can only be used once. Send yourself a new one below.
            </span>
          </Notice>
        ) : null}

        {!canSubmit && !isRecovering && !linkError ? (
          <Notice tone="error">
            Open the reset link from your email to choose a new password.
          </Notice>
        ) : null}

        <Button
          disabled={!canSubmit}
          loading={isRecovering || isSubmitting}
          title={isRecovering ? 'Verifying Link' : 'Update Password'}
          type="submit"
        />

        <div className="flex items-center justify-center gap-2 pt-1">
          <span className="text-sm font-semibold text-white/55">Need another link?</span>
          <Link
            className="text-sm font-black uppercase tracking-[0.12em] text-electric-green hover:brightness-110"
            to={ROUTES.forgotPassword}>
            Send Again
          </Link>
        </div>
      </form>
    </AuthPanel>
  );
}
