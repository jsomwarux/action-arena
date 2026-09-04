import { LegalPage, LegalSection } from '@/components/legal/LegalPage';
import { SUPPORT_EMAIL, TERMS_OF_SERVICE_DOCUMENT } from '@/constants/disclosure';

/**
 * The Action Arena Terms of Service.
 *
 * web/legal publishes index, privacy and support pages but no terms page, so
 * the canonical Terms copy in this repo is TERMS_OF_SERVICE_DOCUMENT — the same
 * constant mobile's app/terms.tsx renders. It is read from there rather than
 * retyped, which makes drift between the two clients impossible: edit the
 * constant and both change.
 */
const [freePlayParagraph, conductParagraph] = TERMS_OF_SERVICE_DOCUMENT.body.split('\n\n');

export function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      intro={TERMS_OF_SERVICE_DOCUMENT.summary}
      title={TERMS_OF_SERVICE_DOCUMENT.title}>
      <div className="flex flex-wrap gap-3">
        {TERMS_OF_SERVICE_DOCUMENT.chips.map((chip) => (
          <div
            className="flex-1 rounded-2xl border border-electric-green/25 bg-electric-green/10 px-4 py-3"
            key={chip}>
            <p className="text-center text-xs font-black uppercase text-electric-green">{chip}</p>
          </div>
        ))}
      </div>

      <LegalSection title="Free Play, No Cash Value">
        <p>{freePlayParagraph}</p>
      </LegalSection>

      <LegalSection title="Conduct and User Content">
        <p>{conductParagraph}</p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about these Terms, reports of objectionable content, or account issues can be
          sent to{' '}
          <a
            className="font-bold text-electric-green hover:underline"
            href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
