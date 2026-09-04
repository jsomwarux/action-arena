import { Config } from '@remotion/cli/config';

// App Store iOS preview spec: 1080x1920 / 30fps / H.264 is declared on the
// Composition itself (src/Root.tsx). These are render-pipeline defaults.
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
