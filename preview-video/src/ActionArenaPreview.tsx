import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { ColdOpen } from './scenes/ColdOpen';
import { TitleCard } from './scenes/TitleCard';
import { ScreenCaptureScene } from './scenes/ScreenCaptureScene';
import { Celebration } from './scenes/Celebration';
import { Wordmark } from './scenes/Wordmark';
import { Compliance } from './scenes/Compliance';
import { FlashWhite } from './scenes/FlashWhite';
import { TOKENS } from './theme';

// 30s @ 30fps = 900 frames. Hard cuts everywhere except the cold-open fade-in,
// the final fade-to-black, the 0:08 Lock detail insert, and the 300ms white
// flash into the celebration. Frame map:
//   0–30    cold open (app icon)
//   30–90   title card ("SETTLE IT / IN THE ARENA.")
//   90–195  build your lineup    (pick_board, 3.5s)
//   195–315 designate your lock  (lineup, 4s, detail cut @ 240)
//   315–435 beat your friends    (leaderboard, 4s)
//   435–585 the moment           (Score Burst, +148, 5s)
//   585–810 brand close          (app icon, 7.5s — music outro)
//   810–900 compliance + fade to black
// Audio: music bed 0:01–0:27 (-18 dBFS) + single synth hit at the burst (-12 dBFS).
export const ActionArenaPreview: React.FC = () => {
  const CELEBRATION_START = 435;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Sequence durationInFrames={30} name="Cold open">
        <ColdOpen />
      </Sequence>

      <Sequence from={30} durationInFrames={60} name="Title card">
        <TitleCard />
      </Sequence>

      <Sequence from={90} durationInFrames={105} name="Build your lineup">
        <ScreenCaptureScene
          image="pick_board.png"
          headline="BUILD YOUR LINEUP."
          accent={TOKENS.electricGreen}
          focusY={0.4}
          pulse={{
            xPct: 50,
            yPct: 48,
            wPct: 80,
            hPct: 13,
            color: TOKENS.electricGreen,
            start: 18,
            dur: 12,
          }}
        />
      </Sequence>

      <Sequence from={195} durationInFrames={120} name="Designate your lock">
        <ScreenCaptureScene
          image="lineup.png"
          headline="DESIGNATE YOUR LOCK."
          accent={TOKENS.gold}
          focusY={0.46}
          pulse={{
            xPct: 50,
            yPct: 44,
            wPct: 82,
            hPct: 12,
            color: TOKENS.gold,
            start: 18,
            dur: 12,
          }}
          detail={{ start: 45, dur: 15, zoom: 1.85, xPct: 0.5, yPct: 0.52 }}
        />
      </Sequence>

      <Sequence from={315} durationInFrames={120} name="Beat your friends">
        <ScreenCaptureScene
          image="leaderboard.png"
          headline="BEAT YOUR FRIENDS."
          accent={TOKENS.electricGreen}
          focusY={0.42}
          pulse={{
            xPct: 50,
            yPct: 70,
            wPct: 86,
            hPct: 9,
            color: TOKENS.electricGreen,
            start: 18,
            dur: 8,
          }}
        />
      </Sequence>

      <Sequence from={CELEBRATION_START} durationInFrames={150} name="The moment">
        <Celebration />
      </Sequence>

      <Sequence from={585} durationInFrames={225} name="Brand close">
        <Wordmark />
      </Sequence>

      <Sequence from={810} durationInFrames={90} name="Compliance">
        <Compliance />
      </Sequence>

      {/* 300ms flash to white, peaking exactly on the cut into the celebration */}
      <Sequence from={CELEBRATION_START - 4} durationInFrames={9} name="Flash">
        <FlashWhite />
      </Sequence>

      {/* music bed: 0:01–0:27, -18 dBFS, builds then half-time drop at the burst */}
      <Sequence from={30} name="Music">
        <Audio src={staticFile('music-bed.wav')} />
      </Sequence>

      {/* single chromatic-split synth hit at the burst, -12 dBFS, punches through */}
      <Sequence from={CELEBRATION_START} name="Hit">
        <Audio src={staticFile('synth-hit.wav')} />
      </Sequence>
    </AbsoluteFill>
  );
};
