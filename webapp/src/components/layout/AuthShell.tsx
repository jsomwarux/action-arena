import type { PropsWithChildren } from 'react';

import { Link } from 'react-router-dom';

import { cn } from '@/lib/cn';
import { ROUTES } from '@/lib/routes';

/**
 * How wide the centred column is. Auth forms want a narrow card; onboarding and
 * the legal documents want room to read.
 */
export type AuthShellWidth = 'lg' | 'md' | 'xl';

const CONTENT_MAX_WIDTH: Record<AuthShellWidth, string> = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export type AuthShellProps = PropsWithChildren<{
  /**
   * Set on screens that render their own <ArenaLogo> — the four auth pages and
   * onboarding — so the wordmark does not appear twice.
   */
  hideWordmark?: boolean;
  width?: AuthShellWidth;
}>;

/**
 * Centered chrome for the routes that render outside the app shell: auth,
 * onboarding, and legal pages. No sidebar, no league selector.
 */
export function AuthShell({ children, hideWordmark = false, width = 'md' }: AuthShellProps) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-arena-bg px-6 py-12">
      {hideWordmark ? null : (
        <Link className="mb-8 flex items-baseline gap-1.5" to={ROUTES.home}>
          <span className="arena-heading text-3xl leading-none">Action</span>
          <span className="arena-heading text-3xl leading-none text-electric-green">Arena</span>
        </Link>
      )}
      <div className={cn('w-full', CONTENT_MAX_WIDTH[width])}>{children}</div>
    </div>
  );
}
