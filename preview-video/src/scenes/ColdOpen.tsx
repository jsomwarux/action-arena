import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { AppIcon } from '../components/AppIcon';
import { bebas } from '../fonts';

// 0:00–0:01 — black screen; the real app icon fades in fast with ACTION ARENA
// below. Tight 1s so the first product moment lands sooner.
export const ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const appear = spring({
    frame,
    fps,
    config: { damping: 16, mass: 0.5, stiffness: 130 },
    durationInFrames: 18,
  });
  const opacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(appear, [0, 1], [0.9, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 30,
          opacity,
          transform: `scale(${scale})`,
        }}
      >
        <AppIcon size={200} />
        <span
          style={{
            fontFamily: bebas,
            fontWeight: 700,
            fontSize: 48,
            color: '#fff',
            letterSpacing: 3,
          }}
        >
          ACTION ARENA
        </span>
      </div>
    </AbsoluteFill>
  );
};
