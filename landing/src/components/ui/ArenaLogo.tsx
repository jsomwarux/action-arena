// The Action Arena "A" mark — green→cyan gradient tile. Pure CSS + text,
// matching favicon.svg. Decorative; the wordmark beside it carries the name.
export function ArenaLogo({ size = 32 }: { size?: number }) {
  return (
    <div
      aria-hidden
      className="flex items-center justify-center font-display font-black leading-none text-arena-bg"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, #00FF87, #18DCFF)',
        borderRadius: 8,
        fontSize: size * 0.6,
        letterSpacing: '-0.04em',
        boxShadow: '0 4px 16px rgba(0,255,135,0.35)',
      }}
    >
      A
    </div>
  );
}
