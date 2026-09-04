import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

// 300ms (9f) flash-to-white at the Leaderboard -> Celebration boundary (fix 6b).
// Placed so the peak lands exactly on the cut, then clears over the burst.
export const FlashWhite: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 4, 9], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill
      style={{ backgroundColor: '#fff', opacity, pointerEvents: 'none' }}
    />
  );
};
