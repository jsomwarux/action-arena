import { PageStub } from '@/components/layout/PageStub';
import { ROUTES } from '@/lib/routes';

export function CoinStorePage() {
  return (
    <PageStub
      description="Arena Coin bundles. Purchase buttons are placeholders."
      route={ROUTES.coinStore}
      title="Coin Store"
    />
  );
}
