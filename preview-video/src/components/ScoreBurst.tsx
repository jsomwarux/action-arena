import { interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { bebas } from '../fonts';
import { TOKENS } from '../theme';

// ---------------------------------------------------------------------------
// Faithful DOM port of ScoreBurstOverlay from components/cosmetics/index.tsx
// (the equipped "Score Burst" win celebration, styleKey 'score', accent green).
//
// The app version is driven by RN Animated.timing on a wall-clock loop, which
// does not advance under Remotion's deterministic frame renderer. This port
// keeps the exact layout, colours, shard geometry and easing of the original,
// but drives every value off useCurrentFrame() and is re-timed for a held hero
// beat: punch in (~0.5s), then SETTLE AND HOLD (the app's quick exit is dropped
// so the scoreboard stays on screen for the 7s celebration). Digits read +148
// to match the overlay copy (the app hard-codes +100).
// ---------------------------------------------------------------------------

const S = 2.7; // scale factor: native ~390pt phone design -> 1080px hero
const px = (n: number) => n * S;

// from SCORE_SHARDS in the source component
const SHARDS = [
  { rotate: -16, text: '7', x: -118, y: -70 },
  { rotate: 12, text: '3', x: 116, y: -60 },
  { rotate: 20, text: '+', x: -94, y: 76 },
  { rotate: -10, text: '1', x: 92, y: 84 },
  { rotate: 8, text: '0', x: -36, y: -104 },
  { rotate: -22, text: '0', x: 42, y: 112 },
] as const;

const DIGITS = ['+', '1', '4', '8'] as const; // +148 (brief), app uses +100

export const ScoreBurst: React.FC<{ accent?: string }> = ({
  accent = TOKENS.electricGreen,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // accent-coloured screen flash on impact
  const flash = interpolate(frame, [0, 2, 8], [0, 0.4, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // plate punch-in with overshoot, settling to a peak at ~1.5s (frame ~45),
  // then gentle breathing. Re-timed for the tighter 5s (150f) celebration.
  const pop = spring({
    frame,
    fps,
    config: { damping: 11, mass: 0.9, stiffness: 95 },
    durationInFrames: 38,
  });
  const settled = interpolate(frame, [0, 38], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const breathe =
    Math.sin((Math.max(0, frame - 30) / fps) * Math.PI * 0.8) * 0.012 * settled;
  const plateScale = interpolate(pop, [0, 1], [0.62, 1.0]) + breathe;
  const plateTranslateY = interpolate(pop, [0, 1], [px(18), 0]);
  const plateOpacity = interpolate(frame, [0, 5], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // recurring sweep shimmer across the plate (every ~70 frames)
  const sweepReady = interpolate(frame, [16, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const sweepT = (frame % 70) / 70;
  const sweepY = interpolate(sweepT, [0, 1], [px(-52), px(52)]);
  const sweepOpacity =
    interpolate(sweepT, [0, 0.12, 0.5, 1], [0, 0.85, 0, 0]) * sweepReady;

  // single shared anchor (screen-x 50%, screen-y 46%) for plate + shards so the
  // burst radiates from one point. Explicit left/top avoids flex static-position
  // centering doubling the translate(-50%) on the wide plate.
  const ANCHOR = { left: '50%', top: '46%' } as const;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    >
      {/* impact flash */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: accent,
          opacity: flash,
        }}
      />

      {/* burst stage */}
      <div style={{ position: 'absolute', inset: 0 }}>
        {/* shards radiating out, settling to a faint linger */}
        {SHARDS.map((sh, i) => {
          const sIn = interpolate(frame, [0, 20], [0, 1], {
            extrapolateRight: 'clamp',
            easing: Easing.out(Easing.cubic),
          });
          const drift = interpolate(frame, [20, 150], [1, 1.12], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const tx = px(sh.x) * sIn * drift;
          const ty = px(sh.y) * sIn * drift;
          const sc = interpolate(frame, [0, 10, 20, 40], [0.4, 1, 0.86, 0.8], {
            extrapolateRight: 'clamp',
          });
          const op = interpolate(frame, [0, 7, 20, 40], [0, 1, 0.85, 0.5], {
            extrapolateRight: 'clamp',
          });
          return (
            <div
              key={`${sh.text}-${i}`}
              style={{
                position: 'absolute',
                left: ANCHOR.left,
                top: ANCHOR.top,
                minWidth: px(38),
                height: px(46),
                paddingLeft: px(7),
                paddingRight: px(7),
                borderRadius: px(6),
                border: `${Math.max(1, px(1))}px solid ${accent}99`,
                backgroundColor: 'rgba(10,14,26,0.86)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: op,
                transform: `translate(-50%, -50%) translate(${tx}px, ${ty}px) rotate(${sh.rotate}deg) scale(${sc})`,
              }}
            >
              <span
                style={{
                  fontFamily: bebas,
                  fontWeight: 900,
                  fontSize: px(30),
                  lineHeight: 1,
                  color: accent,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {sh.text}
              </span>
            </div>
          );
        })}

        {/* scoreboard plate */}
        <div
          style={{
            position: 'absolute',
            left: ANCHOR.left,
            top: ANCHOR.top,
            transform: `translate(-50%, -50%) translateY(${plateTranslateY}px) scale(${plateScale})`,
            opacity: plateOpacity,
            backgroundColor: 'rgba(10,14,26,0.94)',
            borderRadius: px(8),
            border: `${px(3)}px solid ${accent}`,
            overflow: 'hidden',
            paddingLeft: px(24),
            paddingRight: px(24),
            paddingTop: px(14),
            paddingBottom: px(14),
            boxShadow: `0 0 ${px(18)}px ${accent}dd, 0 0 ${px(60)}px ${accent}55`,
          }}
        >
          {/* header: FINAL  /  WIN */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: px(8),
            }}
          >
            {['FINAL', 'WIN'].map((k) => (
              <span
                key={k}
                style={{
                  fontFamily: bebas,
                  fontWeight: 900,
                  fontSize: px(11),
                  letterSpacing: px(1.2),
                  color: accent,
                }}
              >
                {k}
              </span>
            ))}
          </div>

          {/* digit tiles: + 1 4 8 */}
          <div style={{ display: 'flex', flexDirection: 'row', gap: px(8) }}>
            {DIGITS.map((d, i) => {
              const dPop = spring({
                frame,
                fps,
                delay: 8 + i * 4,
                config: { damping: 11, mass: 0.6, stiffness: 150 },
                durationInFrames: 18,
              });
              return (
                <div
                  key={`${d}-${i}`}
                  style={{
                    width: px(46),
                    height: px(64),
                    borderRadius: px(4),
                    border: `${Math.max(1, px(1))}px solid ${accent}66`,
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span
                    style={{
                      fontFamily: bebas,
                      fontWeight: 900,
                      fontSize: px(44),
                      lineHeight: 1,
                      color: accent,
                      fontVariantNumeric: 'tabular-nums',
                      opacity: interpolate(dPop, [0, 1], [0, 1]),
                      transform: `scale(${interpolate(dPop, [0, 1], [0.2, 1])})`,
                      marginTop: px(4),
                    }}
                  >
                    {d}
                  </span>
                </div>
              );
            })}
          </div>

          {/* sweep shimmer */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '50%',
              height: px(2),
              backgroundColor: accent,
              opacity: sweepOpacity,
              transform: `translateY(${sweepY}px)`,
              boxShadow: `0 0 ${px(10)}px ${accent}`,
            }}
          />
        </div>
      </div>
    </div>
  );
};
