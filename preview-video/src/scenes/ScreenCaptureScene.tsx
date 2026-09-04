import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { bebas } from '../fonts';
import { TOKENS } from '../theme';

// A single accent flourish that pulses once, shortly after the headline lands.
// Positioned inside the Ken Burns container so it tracks the zoom and stays on
// its UI element. Rendered with screen blend so it lights the element up.
export type AccentPulse = {
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  color: string;
  start: number; // local frame
  dur: number; // frames
};

// A 500ms detail insert: hard-cut to an extreme close-up on a region of the
// same capture, then hard-cut back to the full screen.
export type DetailCut = {
  start: number; // local frame
  dur: number; // frames
  zoom: number;
  xPct: number; // object-position focus
  yPct: number;
};

export const ScreenCaptureScene: React.FC<{
  image: string;
  headline: string;
  accent?: string;
  focusY?: number;
  kbTo?: number;
  pulse?: AccentPulse;
  detail?: DetailCut;
}> = ({
  image,
  headline,
  accent = TOKENS.electricGreen,
  focusY = 0.42,
  kbTo = 1.12,
  pulse,
  detail,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const inDetail =
    detail != null &&
    frame >= detail.start &&
    frame < detail.start + detail.dur;

  // ---- Detail insert (hard cut in/out) ----
  if (inDetail && detail) {
    const dl = frame - detail.start;
    const push = interpolate(dl, [0, detail.dur], [detail.zoom, detail.zoom * 1.06], {
      easing: Easing.out(Easing.cubic),
    });
    return (
      <AbsoluteFill style={{ backgroundColor: TOKENS.arenaBg, overflow: 'hidden' }}>
        <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: '50% 50%' }}>
          <Img
            src={staticFile(image)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: `${detail.xPct * 100}% ${detail.yPct * 100}%`,
            }}
          />
        </AbsoluteFill>
        {/* accent vignette to signal the detail beat */}
        <AbsoluteFill
          style={{
            boxShadow: `inset 0 0 220px ${accent}3a`,
            background: `radial-gradient(circle at 50% 50%, ${accent}1f 0%, rgba(10,14,26,0) 46%)`,
          }}
        />
      </AbsoluteFill>
    );
  }

  // ---- Normal full-screen shot ----
  const kb = interpolate(frame, [0, durationInFrames], [1.0, kbTo], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const hIn = interpolate(frame, [2, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const pulseOpacity = pulse
    ? interpolate(
        frame,
        [pulse.start, pulse.start + pulse.dur * 0.3, pulse.start + pulse.dur],
        [0, 0.85, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      )
    : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: TOKENS.arenaBg, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${kb})`, transformOrigin: '50% 46%' }}>
        <Img
          src={staticFile(image)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: `50% ${focusY * 100}%`,
          }}
        />
        {/* accent pulse — tracks the zoom because it shares this container */}
        {pulse && (
          <div
            style={{
              position: 'absolute',
              left: `${pulse.xPct}%`,
              top: `${pulse.yPct}%`,
              width: `${pulse.wPct}%`,
              height: `${pulse.hPct}%`,
              transform: 'translate(-50%, -50%)',
              borderRadius: 28,
              background: `radial-gradient(ellipse at center, ${pulse.color}cc 0%, ${pulse.color}00 70%)`,
              opacity: pulseOpacity,
              mixBlendMode: 'screen',
            }}
          />
        )}
      </AbsoluteFill>

      {/* top legibility scrim */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(10,14,26,0.94) 0%, rgba(10,14,26,0.62) 13%, rgba(10,14,26,0) 32%)',
        }}
      />
      {/* bottom vignette */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(0deg, rgba(10,14,26,0.6) 0%, rgba(10,14,26,0) 24%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 100,
          left: 64,
          right: 64,
          opacity: hIn,
          transform: `translateY(${interpolate(hIn, [0, 1], [-16, 0])}px)`,
        }}
      >
        <div
          style={{
            fontFamily: bebas,
            fontWeight: 900,
            fontSize: 88,
            color: '#fff',
            lineHeight: 0.94,
            letterSpacing: '-0.01em',
            textShadow: '0 6px 34px rgba(0,0,0,0.65)',
          }}
        >
          {headline}
        </div>
        <div
          style={{
            width: 104,
            height: 9,
            borderRadius: 5,
            backgroundColor: accent,
            marginTop: 22,
            boxShadow: `0 0 22px ${accent}aa`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
