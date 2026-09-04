import { Link } from 'react-router-dom';

import { Card } from '@/components/ui';
import { ROUTES } from '@/lib/routes';

/** Web equivalent of app/+not-found.tsx. */
export function NotFoundPage() {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-coral-red">404</p>
        <h1 className="arena-heading text-5xl leading-none">Off the board</h1>
      </header>

      <Card className="flex flex-col gap-3">
        <p className="text-textMuted">That route does not exist.</p>
        <Link className="w-fit font-bold text-electric-green hover:underline" to={ROUTES.home}>
          Back to Home
        </Link>
      </Card>
    </section>
  );
}
