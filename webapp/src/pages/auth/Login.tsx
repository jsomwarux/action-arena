import { useState, type FormEvent } from 'react';

import { Link, useNavigate } from 'react-router-dom';

import { AuthPanel } from '@/components/auth/AuthPanel';
import { Button, Notice, TextInput } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { resolveLandingRoute } from '@/lib/post-auth';
import { ROUTES } from '@/lib/routes';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to sign in. Please try again.';
}

/** Port of app/(auth)/login.tsx. Same validation and copy, desktop card. */
export function LoginPage() {
  const navigate = useNavigate();
  const { signInWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signInWithPassword(email.trim(), password);
      const landing = await resolveLandingRoute();
      navigate(landing.to, { replace: true, state: landing.state });
    } catch (loginError) {
      setError(getErrorMessage(loginError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPanel
      kicker="Player Login"
      tagline="Sign in. Build your slate. Stack profit."
      title="Welcome Back">
      <form className="flex flex-col gap-5" noValidate onSubmit={handleLogin}>
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
          autoComplete="current-password"
          label="Password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Your password"
          showPasswordToggle
          value={password}
        />

        <div className="-mt-2 flex justify-end">
          <Link
            className="text-sm font-black text-electric-green hover:brightness-110"
            to={ROUTES.forgotPassword}>
            Forgot password?
          </Link>
        </div>

        {error ? <Notice tone="error">{error}</Notice> : null}

        <Button loading={isSubmitting} title="Log In" type="submit" />

        <div className="flex items-center justify-center gap-2 pt-1">
          <span className="text-sm font-semibold text-white/55">New to the Arena?</span>
          <Link
            className="text-sm font-black uppercase tracking-[0.12em] text-electric-green hover:brightness-110"
            to={ROUTES.signup}>
            Sign Up
          </Link>
        </div>
      </form>
    </AuthPanel>
  );
}
