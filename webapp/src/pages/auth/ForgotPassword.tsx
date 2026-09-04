import { useState, type FormEvent } from 'react';

import { Link } from 'react-router-dom';

import { AuthPanel } from '@/components/auth/AuthPanel';
import { Button, Notice, TextInput } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { ROUTES } from '@/lib/routes';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to send a reset email. Please try again.';
}

/** Port of app/(auth)/forgot-password.tsx. Same validation and copy. */
export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRequestReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedEmail = email.trim();
    setError(undefined);
    setNotice(undefined);

    if (!trimmedEmail) {
      setError('Enter the email on your Action Arena account.');
      return;
    }

    setIsSubmitting(true);
    try {
      await requestPasswordReset(trimmedEmail);
      setNotice(
        'Check your email for a reset link. It will open Action Arena to set a new password.',
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPanel
      eyebrow="ACCOUNT · RECOVERY"
      kicker="Password Reset"
      tagline="Get back in and keep your picks alive."
      title="Send Reset Link">
      <form className="flex flex-col gap-5" noValidate onSubmit={handleRequestReset}>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect="off"
          label="Email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          type="email"
          value={email}
        />

        {error ? <Notice tone="error">{error}</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}

        <Button loading={isSubmitting} title="Send Reset Link" type="submit" />

        <div className="flex items-center justify-center gap-2 pt-1">
          <span className="text-sm font-semibold text-white/55">Remembered it?</span>
          <Link
            className="text-sm font-black uppercase tracking-[0.12em] text-electric-green hover:brightness-110"
            to={ROUTES.login}>
            Log In
          </Link>
        </div>
      </form>
    </AuthPanel>
  );
}
