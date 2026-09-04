import { useEffect, useRef, useState } from 'react';

import { ChevronDown, LogOut, Settings as SettingsIcon, UserCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/use-auth';
import { useCurrentUserProfile } from '@/hooks/use-user-profile';
import { cn } from '@/lib/cn';
import { ROUTES } from '@/lib/routes';

/**
 * Falls back through the three places a name can come from, in order of how
 * current they are: the users row Settings writes, the metadata signup wrote,
 * and finally the local part of the email so the menu is never blank.
 */
function resolveDisplayName(
  profileName: string | null | undefined,
  metadataName: unknown,
  email: string | undefined,
) {
  if (profileName && profileName.trim()) {
    return profileName.trim();
  }

  if (typeof metadataName === 'string' && metadataName.trim()) {
    return metadataName.trim();
  }

  return email?.split('@')[0] ?? 'Account';
}

function UserMenu() {
  const { signOut, user } = useAuth();
  const { data: profile } = useCurrentUserProfile(user?.id);
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const displayName = resolveDisplayName(
    profile?.display_name,
    user?.user_metadata?.display_name,
    user?.email,
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      // No navigation needed: RequireAuth sends the cleared session to /login.
      await signOut();
    } finally {
      setIsSigningOut(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-xl border border-border bg-white/[0.04] px-3 py-2 transition hover:bg-white/[0.07]"
        onClick={() => setIsOpen((open) => !open)}
        type="button">
        <UserCircle aria-hidden className="h-5 w-5 text-white/70" />
        <span className="max-w-[12rem] truncate text-sm font-bold text-white/85">{displayName}</span>
        <ChevronDown
          aria-hidden
          className={cn('h-4 w-4 text-white/45 transition', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen ? (
        <div
          className="arena-glass absolute right-0 top-[calc(100%+0.5rem)] z-30 w-60 overflow-hidden p-1.5"
          role="menu">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-bold text-white">{displayName}</p>
            {user?.email ? (
              <p className="truncate text-xs font-semibold text-textMuted">{user.email}</p>
            ) : null}
          </div>

          <div className="my-1 h-px bg-border" />

          <Link
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-bold text-white/80 transition hover:bg-white/[0.07] hover:text-white"
            onClick={() => setIsOpen(false)}
            role="menuitem"
            to={ROUTES.settings}>
            <SettingsIcon aria-hidden className="h-4 w-4" />
            Settings
          </Link>

          <button
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-bold text-coral-red transition hover:bg-coral-red/10 disabled:opacity-50"
            disabled={isSigningOut}
            onClick={() => void handleSignOut()}
            role="menuitem"
            type="button">
            <LogOut aria-hidden className="h-4 w-4" />
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Top bar: league selector on the left, user menu on the right.
 *
 * TODO(webapp): the league selector becomes a real dropdown once the leagues
 * hook lands. The user menu is wired.
 */
export function TopBar() {
  return (
    <header className="sticky top-0 z-20 flex h-topbar items-center justify-between gap-4 border-b border-border bg-arena-bg/80 px-6 backdrop-blur-xl">
      <button
        aria-label="Select league (not wired up yet)"
        className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-white/[0.04] px-3 py-2 text-left transition hover:bg-white/[0.07]"
        disabled
        type="button">
        <span className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-textMuted">
            League
          </span>
          <span className="truncate text-sm font-bold text-white/85">Select a league</span>
        </span>
        <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-white/45" />
      </button>

      <UserMenu />
    </header>
  );
}
