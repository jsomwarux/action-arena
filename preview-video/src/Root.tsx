import { Composition } from 'remotion';
import { ActionArenaPreview } from './ActionArenaPreview';

// 30s @ 30fps = 900 frames, 1080x1920 vertical (App Store iOS preview spec).
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="ActionArenaPreview"
      component={ActionArenaPreview}
      durationInFrames={900}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
