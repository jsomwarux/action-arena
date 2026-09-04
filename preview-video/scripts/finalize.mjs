// Post-processes the Remotion render into an App Store-compliant deliverable.
//
// Remotion pads the AAC audio track to the full composition length, and AAC
// encoder priming then pushes the *container* ~59ms past 30.0s — which App
// Store Connect rejects ("App preview is longer than 30 seconds"). Audio
// content (music bed + synth hit) ends by 0:27, so trimming the track to 29s
// keeps every audio frame while staying under 30s, letting the exact 30.000s
// H.264 video govern the container duration. +faststart fronts the moov atom
// so the App Store auto-preview starts instantly.
import { execFileSync } from 'node:child_process';
import { rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '..', 'out');
const raw = resolve(out, '_raw.mp4');
const final = resolve(out, 'action-arena-preview-v1.mp4');

if (!existsSync(raw)) {
  console.error('finalize: missing out/_raw.mp4 — run the Remotion render first');
  process.exit(1);
}

execFileSync(
  'ffmpeg',
  [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', raw,
    '-map', '0:v:0', '-map', '0:a:0',
    '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '256k',
    '-af', 'atrim=0:29',
    '-movflags', '+faststart',
    final,
  ],
  { stdio: 'inherit' }
);

rmSync(raw, { force: true });
console.log('finalize: wrote', final, '(30.000s, +faststart)');
