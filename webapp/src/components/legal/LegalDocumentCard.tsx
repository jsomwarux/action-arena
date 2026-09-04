import { ShieldCheck } from 'lucide-react';

import { ArenaLogo, Button, Card } from '@/components/ui';

export type LegalDocumentCardProps = {
  body: string;
  buttonLabel: string;
  buttonLoading?: boolean;
  chips: readonly [string, string];
  onButtonPress: () => void;
  title: string;
};

/** Port of components/legal/legal-document-card.tsx. */
export function LegalDocumentCard({
  body,
  buttonLabel,
  buttonLoading,
  chips,
  onButtonPress,
  title,
}: LegalDocumentCardProps) {
  return (
    <Card className="p-6" tone="highlight">
      <div className="flex flex-col items-center gap-6 py-2">
        <ArenaLogo align="center" eyebrow="FREE · FANTASY · PICKS" size="md" />

        <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-electric-green/45 bg-electric-green/15 shadow-[0_0_16px_rgba(0,255,135,0.45)]">
          <ShieldCheck aria-hidden className="h-7 w-7 text-electric-green" />
        </div>

        <div className="flex flex-col items-center gap-3">
          <h1 className="text-center text-3xl font-black uppercase leading-9 text-white">{title}</h1>
          <p className="text-center text-base font-semibold leading-6 text-white/65">{body}</p>
        </div>

        <div className="flex w-full gap-3">
          {chips.map((chip) => (
            <div
              className="flex-1 rounded-2xl border border-electric-green/25 bg-electric-green/10 px-4 py-3"
              key={chip}>
              <p className="text-center text-xs font-black uppercase text-electric-green">{chip}</p>
            </div>
          ))}
        </div>

        <div className="w-full">
          <Button loading={buttonLoading} onClick={onButtonPress} title={buttonLabel} />
        </div>
      </div>
    </Card>
  );
}
