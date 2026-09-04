import { PageStub } from '@/components/layout/PageStub';
import { ROUTES } from '@/lib/routes';

export function ShopPage() {
  return (
    <PageStub
      description="Cosmetic catalog priced in Arena Coins."
      route={ROUTES.shop}
      title="Shop"
    />
  );
}
