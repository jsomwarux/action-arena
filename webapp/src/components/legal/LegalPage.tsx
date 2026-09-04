import type { PropsWithChildren, ReactNode } from 'react';

import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { Card } from '@/components/ui';
import { ROUTES } from '@/lib/routes';

/**
 * Chrome for the two long-form legal routes.
 *
 * /terms and /privacy render outside the app shell, exactly as they do on
 * mobile, where they are pushed screens with a back button rather than tabs.
 * They also render outside AuthShell: its widest tier is a 36rem card, which is
 * a poor column for a policy with headed sections, lists and a table. This
 * gives them a reading column of their own and the same back affordance the
 * phone has.
 */
export function LegalPage({
  children,
  effectiveDate,
  eyebrow,
  intro,
  title,
}: PropsWithChildren<{
  effectiveDate?: string;
  eyebrow: string;
  intro: ReactNode;
  title: string;
}>) {
  const navigate = useNavigate();

  return (
    <div className="min-h-full bg-arena-bg px-6 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link className="flex items-baseline gap-1.5" to={ROUTES.home}>
            <span className="arena-heading text-2xl leading-none">Action</span>
            <span className="arena-heading text-2xl leading-none text-electric-green">Arena</span>
          </Link>

          <button
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white/[0.04] px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/[0.08] hover:text-white"
            onClick={() => navigate(-1)}
            type="button">
            <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
            Back
          </button>
        </div>

        <header className="mt-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-electric-green">
            {eyebrow}
          </p>
          <h1 className="arena-heading mt-2 text-5xl leading-none">{title}</h1>
          {effectiveDate ? (
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/40">
              Effective date: {effectiveDate}
            </p>
          ) : null}
          <div className="mt-4 text-base font-medium leading-7 text-white/70">{intro}</div>
        </header>

        <div className="mt-8 flex flex-col gap-4 pb-16">{children}</div>
      </div>
    </div>
  );
}

/** One headed block of policy copy. */
export function LegalSection({ children, title }: PropsWithChildren<{ title: string }>) {
  return (
    <Card className="p-6">
      <h2 className="arena-heading text-2xl leading-none">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-sm font-medium leading-7 text-white/70">
        {children}
      </div>
    </Card>
  );
}

/** A bulleted list in policy copy. `<strong>` leads read as gold, as on the static site. */
export function LegalList({ children }: PropsWithChildren) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-electric-green/60">{children}</ul>
  );
}

export function LegalTerm({ children }: PropsWithChildren) {
  return <strong className="font-black text-white">{children}</strong>;
}
