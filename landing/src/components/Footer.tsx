// Footer.tsx — compliance disclosure (App Store Guideline 5.3) + utility
// links. Disclosure copy is verbatim from the Claude Design artifact; the
// NFL non-affiliation line is the locked trademark treatment. id="compliance"
// is the target of the nav "Compliance" link.
import { ArenaLogo } from './ui/ArenaLogo';

// Placeholder targets — wire up real pages before launch (see README).
const LINKS: Array<{ label: string; href: string }> = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Press kit', href: '/press-kit' },
  { label: 'Support', href: 'mailto:hello@actionarena.app' },
];

export function Footer() {
  return (
    <footer id="compliance" className="border-t border-white/[0.06] bg-arena-bg px-5 py-8 text-white/45 lg:px-14 lg:py-10">
      <div className="mx-auto flex max-w-[1280px] flex-col justify-between gap-5 lg:flex-row lg:items-end lg:gap-8">
        <div>
          <div className="mb-2.5 flex items-center gap-2.5">
            <ArenaLogo size={22} />
            <span className="font-display text-base font-black tracking-[0.08em] text-textPrimary">ACTION ARENA</span>
          </div>
          <p className="max-w-[480px] text-xs leading-[1.5]">
            A fantasy sports prediction game. Build a weekly lineup against a virtual-coin budget and compete with
            friends. Virtual currency only — not a gambling product. Cosmetic items have no monetary value and cannot be
            redeemed for cash.
          </p>
          <p className="mt-2 max-w-[480px] text-[11px] leading-[1.5] text-white/35">
            NFL team names used for game identification only; Action Arena is not affiliated with, endorsed, or
            sponsored by the National Football League.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-6 text-xs">
          {LINKS.map((l) => (
            <a key={l.label} href={l.href} className="text-white/55 transition-colors hover:text-textPrimary">
              {l.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
