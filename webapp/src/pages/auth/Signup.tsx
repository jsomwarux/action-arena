import { useState, type FormEvent } from 'react';

import { Link, useNavigate } from 'react-router-dom';

import { AuthPanel } from '@/components/auth/AuthPanel';
import { Button, Notice, TextInput } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { resolveLandingRoute } from '@/lib/post-auth';
import { ROUTES } from '@/lib/routes';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to create your account. Please try again.';
}

/** Port of app/(auth)/signup.tsx. Same validation and copy, desktop card. */
export function SignupPage() {
  const navigate = useNavigate();
  const { signUpWithPassword } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);
    setNotice(undefined);

    if (!displayName.trim() || !email.trim() || password.length < 6) {
      setError('Enter a display name, email, and a password with at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const session = await signUpWithPassword(email.trim(), password, displayName.trim());
      if (session) {
        const landing = await resolveLandingRoute();
        navigate(landing.to, { replace: true, state: landing.state });
      } else {
        // Reached only if this Supabase project turns email confirmation on;
        // today it reports mailer_autoconfirm, so signUp returns a session.
        setNotice('Account created. Check your email to confirm your signup before logging in.');
      }
    } catch (signupError) {
      setError(getErrorMessage(signupError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPanel
      eyebrow="JOIN · THE · ARENA"
      kicker="Create Account"
      tagline="Build your team identity. Compete every week."
      title="Get Drafted In">
      <form className="flex flex-col gap-5" noValidate onSubmit={handleSignup}>
        <TextInput
          autoComplete="nickname"
          label="Display name"
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Sunday Strategist"
          value={displayName}
        />
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
        <TextInput
          autoCapitalize="none"
          autoComplete="new-password"
          label="Password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 6 characters"
          showPasswordToggle
          value={password}
        />

        {error ? <Notice tone="error">{error}</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}

        <p className="text-center text-xs font-semibold leading-5 tracking-[0.01em] text-white/55">
          By creating an account, you agree to our{' '}
          <Link className="font-black text-electric-green hover:brightness-110" to={ROUTES.terms}>
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link className="font-black text-electric-green hover:brightness-110" to={ROUTES.privacy}>
            Privacy Policy
          </Link>
          .
        </p>

        <Button loading={isSubmitting} title="Create Account" type="submit" />

        <div className="flex items-center justify-center gap-2 pt-1">
          <span className="text-sm font-semibold text-white/55">Already a player?</span>
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
