import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { AppIcon } from '../components/AppIcon';
import { bebas, inter } from '../fonts';
import { TOKENS } from '../theme';

// 0:27–0:30 — compliance card: subtle small print bottom-center, then fade to
// black. Keeps a dim brand mark for continuity (Apple Guideline 5.3 framing:
// fantasy prediction game, virtual currency only).
export const Compliance: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const textIn = interpolate(frame, [4, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // fade whole card to black over the last ~24 frames
  const toBlack = interpolate(
    frame,
    [durationInFrames - 24, durationInFrames - 1],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: TOKENS.arenaBg }}>
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 26,
          opacity: textIn,
        }}
      >
        <div style={{ opacity: 0.6 }}>
          <AppIcon size={96} glowOpacity={0.3} glowRadius={12} />
        </div>
        <span
          style={{
            fontFamily: bebas,
            fontWeight: 700,
            fontSize: 40,
            color: '#fff',
            opacity: 0.82,
            letterSpacing: 3,
          }}
        >
          ACTION ARENA
        </span>
      </AbsoluteFill>

      {/* compliance small print, bottom-center */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 150,
          textAlign: 'center',
          opacity: textIn,
        }}
      >
        <div
          style={{
            fontFamily: inter,
            fontWeight: 400,
            fontSize: 24,
            lineHeight: 1.3,
            color: TOKENS.textPrimary,
            opacity: 0.6,
          }}
        >
          Fantasy sports prediction game.
          <br />
          Virtual currency only — not a gambling product.
        </div>
      </div>

      {/* fade to black */}
      <AbsoluteFill
        style={{ backgroundColor: '#000', opacity: toBlack, pointerEvents: 'none' }}
      />
    </AbsoluteFill>
  );
};
