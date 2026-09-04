import type { PropsWithChildren } from 'react';

import { ArenaLogo, Card, Notice } from '@/components/ui';
import { isSupabaseConfigured } from '@/lib/supabase';

export type AuthPanelProps = PropsWithChildren<{
  /** Small letterspaced line above the wordmark, e.g. 'ACCOUNT · RECOVERY'. */
  eyebrow?: string;
  /** Uppercase kicker inside the card, e.g. 'Player Login'. */
  kicker: string;
  /** Sentence under the wordmark. */
  tagline: string;
  /** Big card heading, e.g. 'Welcome Back'. */
  title: string;
}>;

/**
 * The chrome every auth screen shares — wordmark, tagline, and a card headed by
 * a kicker and title. Mobile repeats this markup in each of the four screens;
 * on desktop it is one centred card, so it is worth having once.
 *
 * The Supabase-not-configured strip lives here too, exactly as each mobile
 * screen renders it.
 */
export function AuthPanel({ children, eyebrow, kicker, tagline, title }: AuthPanelProps) {
  return (
    <div className="flex flex-col">
      <div className="mb-8">
        <ArenaLogo eyebrow={eyebrow} />
        <p className="mt-6 text-base font-semibold tracking-[0.01em] text-white/65">{tagline}</p>
      </div>

      <Card className="p-6">
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-electric-green">
              {kicker}
            </p>
            <h1 className="mt-1 text-2xl font-black uppercase tracking-[-0.01em] text-white">
              {title}
            </h1>
          </div>

          {!isSupabaseConfigured ? (
            <Notice tone="error">
              Account services are unavailable right now. Please try again later.
            </Notice>
          ) : null}

          {children}
        </div>
      </Card>
    </div>
  );
}
