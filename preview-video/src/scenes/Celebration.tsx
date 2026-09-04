import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from 'remotion';
import { ScoreBurst } from '../components/ScoreBurst';
import { bebas } from '../fonts';
import { TOKENS } from '../theme';

// 0:17–0:24 — THE MOMENT. The Score Burst win celebration (faithful port) over
// an intensifying green glow. Bottom-third overlay arrives at the peak (~18s).
export const Celebration: React.FC = () => {
  const frame = useCurrentFrame();
  const accent = TOKENS.electricGreen;

  // ambient glow: snaps up on impact, then breathes
  const glowBase = interpolate(frame, [0, 8, 45], [0.06, 0.55, 0.34], {
    extrapolateRight: 'clamp',
  });
  const glowBreathe = Math.sin((frame / 30) * Math.PI * 0.7) * 0.05;
  const glow = glowBase + glowBreathe;

  // bottom-third hero copy, in at the celebration peak (~frame 45 = 0:16)
  const tIn = interpolate(frame, [42, 58], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: TOKENS.arenaBg }}>
      {/* radial green glow behind the burst */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 44%, ${accent}40 0%, rgba(10,14,26,0) 55%)`,
          opacity: Math.max(0, glow),
        }}
      />
      {/* subtle floor vignette */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(0deg, rgba(0,0,0,0.45) 0%, rgba(10,14,26,0) 30%)',
        }}
      />

      <ScoreBurst accent={accent} />

      {/* overlay copy — white per brief, two lines for impact */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 300,
          textAlign: 'center',
          opacity: tIn,
          transform: `translateY(${interpolate(tIn, [0, 1], [30, 0])}px)`,
        }}
      >
        <div
          style={{
            fontFamily: bebas,
            fontWeight: 900,
            fontSize: 96,
            color: '#fff',
            lineHeight: 0.95,
            letterSpacing: '-0.01em',
            textShadow: '0 8px 44px rgba(0,0,0,0.6)',
          }}
        >
          PARLAY HIT.
          <br />
          +148 COINS.
        </div>
      </div>
    </AbsoluteFill>
  );
};
