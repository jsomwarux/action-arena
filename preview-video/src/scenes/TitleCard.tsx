import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { bebas } from '../fonts';
import { TOKENS } from '../theme';

// 0:01–0:03 — arena-bg + electric-green radial. Headline only (subhead dropped
// to tighten the opening). Subtle in-scene settle.
export const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();
  const rise = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const ty = interpolate(rise, [0, 1], [16, 0]);

  return (
    <AbsoluteFill style={{ backgroundColor: TOKENS.arenaBg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 38%, ${TOKENS.electricGreen}30 0%, rgba(10,14,26,0) 58%)`,
        }}
      />
      <AbsoluteFill
        style={{ alignItems: 'center', justifyContent: 'center', padding: 80 }}
      >
        <div
          style={{
            textAlign: 'center',
            opacity: rise,
            transform: `translateY(${ty}px)`,
          }}
        >
          <div
            style={{
              fontFamily: bebas,
              fontWeight: 900,
              fontSize: 104,
              color: '#fff',
              lineHeight: 0.9,
              letterSpacing: '-0.02em',
            }}
          >
            SETTLE IT
            <br />
            IN THE ARENA.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
