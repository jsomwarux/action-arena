import type { PropsWithChildren } from 'react';

import { Link } from 'react-router-dom';

import { ROUTES } from '@/lib/routes';

/**
 * Centered chrome for the routes that render outside the app shell: auth,
 * onboarding, and legal pages. No sidebar, no league selector.
 */
export function AuthShell({ children }: PropsWithChildren) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-arena-bg px-6 py-12">
      <Link className="mb-8 flex items-baseline gap-1.5" to={ROUTES.home}>
        <span className="arena-heading text-3xl leading-none">Action</span>
        <span className="arena-heading text-3xl leading-none text-electric-green">Arena</span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
