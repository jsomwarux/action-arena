import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { AppIcon } from '../components/AppIcon';
import { bebas, inter } from '../fonts';
import { TOKENS } from '../theme';

// 0:19.5–0:27 — brand close (7.5s). The freed time from the tightened front +
// celebration lands here as the music outro. Phased reveal + sustained motion
// (icon float, glow breathing, late value line) so the longer hold never reads
// static. Uses the real app icon.
export const Wordmark: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pop = spring({
    frame,
    fps,
    config: { damping: 13, mass: 0.6, stiffness: 110 },
    durationInFrames: 26,
  });
  const markScale = interpolate(pop, [0, 1], [0.82, 1]);
  const float = Math.sin((frame / fps) * Math.PI * 0.5) * 6; // slow vertical float
  const glowPulse = 0.4 + 0.12 * (0.5 + 0.5 * Math.sin((frame / fps) * Math.PI * 0.6));

  const wordIn = interpolate(frame, [8, 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const tagIn = interpolate(frame, [24, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  // accurate value line (free-to-play per INTAKE) fades in late to fill the hold
  const freeIn = interpolate(frame, [120, 140], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: TOKENS.arenaBg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 42%, ${TOKENS.electricGreen}33 0%, rgba(10,14,26,0) 56%)`,
        }}
      />
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 32,
        }}
      >
        <div style={{ transform: `translateY(${float}px) scale(${markScale})` }}>
          <AppIcon size={200} glowOpacity={glowPulse} glowRadius={22} />
        </div>
        <span
          style={{
            fontFamily: bebas,
            fontWeight: 900,
            fontSize: 104,
            color: '#fff',
            letterSpacing: 4,
            lineHeight: 1,
            opacity: wordIn,
            transform: `translateY(${interpolate(wordIn, [0, 1], [14, 0])}px)`,
          }}
        >
          ACTION ARENA
        </span>
        <span
          style={{
            fontFamily: inter,
            fontWeight: 500,
            fontSize: 34,
            color: TOKENS.textPrimary,
            opacity: 0.85 * tagIn,
            transform: `translateY(${interpolate(tagIn, [0, 1], [12, 0])}px)`,
          }}
        >
          Settle it in the Arena.
        </span>
        <span
          style={{
            fontFamily: inter,
            fontWeight: 700,
            fontSize: 22,
            color: TOKENS.electricGreen,
            letterSpacing: 4,
            marginTop: 8,
            opacity: 0.9 * freeIn,
          }}
        >
          FREE TO PLAY
        </span>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
