import { Img, staticFile } from 'remotion';

// The literal shipped iOS app icon (assets/images/icon.png) so the preview mark
// is identical to the one on the App Store. iOS corner-radius ratio ≈ 0.2237
// (44px at 200px, per the brief). Subtle electric-green glow per spec:
// shadowColor #00FF87, opacity 0.45, radius 14.
export const AppIcon: React.FC<{
  size?: number;
  glowOpacity?: number;
  glowRadius?: number;
}> = ({ size = 200, glowOpacity = 0.45, glowRadius = 14 }) => {
  return (
    <Img
      src={staticFile('icon.png')}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.22),
        boxShadow: `0 0 ${glowRadius}px rgba(0,255,135,${glowOpacity})`,
      }}
    />
  );
};
