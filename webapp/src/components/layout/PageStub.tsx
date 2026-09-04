import type { PropsWithChildren } from 'react';

import { useParams } from 'react-router-dom';

import { Card } from '@/components/ui';

export type PageStubProps = PropsWithChildren<{
  /** Optional one-liner describing what this screen will eventually do. */
  description?: string;
  /** The route pattern this page is mounted at, e.g. '/leagues/:leagueId'. */
  route: string;
  /** Human-readable screen name. */
  title: string;
}>;

/**
 * Placeholder body shared by every route stub.
 *
 * Replace the whole `<PageStub>` element when you build the real screen — this
 * component is scaffolding, not a layout primitive to build on top of.
 */
export function PageStub({ children, description, route, title }: PageStubProps) {
  const params = useParams();
  const paramEntries = Object.entries(params).filter(([key]) => key !== '*');

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-electric-green">
          Stub screen
        </p>
        <h1 className="arena-heading text-5xl leading-none">{title}</h1>
        {description ? <p className="max-w-2xl text-textMuted">{description}</p> : null}
      </header>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-bold uppercase tracking-[0.12em] text-white/50">Route</span>
          <code className="rounded-md bg-white/[0.06] px-2 py-1 font-mono text-electric-green">
            {route}
          </code>
        </div>

        {paramEntries.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-bold uppercase tracking-[0.12em] text-white/50">Params</span>
            {paramEntries.map(([key, value]) => (
              <code
                className="rounded-md bg-white/[0.06] px-2 py-1 font-mono text-white/80"
                key={key}>
                {key}={value ?? '—'}
              </code>
            ))}
          </div>
        ) : null}

        <p className="text-sm text-textMuted">
          Not built yet. Replace this stub with the real screen.
        </p>
      </Card>

      {children}
    </section>
  );
}
