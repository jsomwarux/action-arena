// Pre-renders the single "chromatic-split synth hit" for the 0:17 celebration.
// Dependency-free: synthesizes a triumphant major stab, split into two copies
// detuned +/- ~9 cents and panned hard L/R (the "chromatic split"), plus a sub
// thump and a filtered noise/donk transient. Peak-normalized to -12 dBFS so it
// never blows out the App Store auto-preview. Writes public/synth-hit.wav.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const SR = 44100;
const DUR = 1.7;
const N = Math.floor(SR * DUR);

// C major stab (C4 E4 G4 C5) — bright, victorious.
const CHORD = [261.63, 329.63, 392.0, 523.25];
const centsRatio = (c) => Math.pow(2, c / 1200);

// One detuned voice: sine fundamental + a few harmonics for body/edge.
function voice(t, f, detuneCents) {
  const ff = f * centsRatio(detuneCents);
  const w = 2 * Math.PI * ff * t;
  return (
    Math.sin(w) +
    0.45 * Math.sin(2 * w) +
    0.22 * Math.sin(3 * w) +
    0.12 * Math.sin(4 * w)
  );
}

// deterministic noise (no Math.random — reproducible renders)
let seed = 1337;
const noise = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return (seed / 0x7fffffff) * 2 - 1;
};

const L = new Float64Array(N);
const R = new Float64Array(N);
let lpL = 0;
let lpR = 0;

for (let i = 0; i < N; i++) {
  const t = i / SR;
  const env = Math.exp(-t / 0.5) * (1 - Math.exp(-t / 0.004)); // attack + decay
  const subEnv = Math.exp(-t / 0.18) * (1 - Math.exp(-t / 0.002));
  const nEnv = Math.exp(-t / 0.03); // noise transient
  const dEnv = Math.exp(-t / 0.045); // donk transient

  let l = 0;
  let r = 0;
  for (const f of CHORD) {
    l += voice(t, f, +9); // left: pitched up
    r += voice(t, f, -9); // right: pitched down -> chromatic split
  }
  l /= CHORD.length;
  r /= CHORD.length;
  l *= env;
  r *= env;

  // sub thump (mono, centered)
  const sub = Math.sin(2 * Math.PI * 65.41 * t) * subEnv * 0.9;

  // 1-pole lowpassed noise crack
  lpL += 0.22 * (noise() * nEnv - lpL);
  lpR += 0.22 * (noise() * nEnv - lpR);

  // pitch-down "donk" (quick downward chirp ~220->90 Hz)
  const donkPhase = 2 * Math.PI * (220 * t - ((220 - 90) * 0.5 * (t * t)) / 0.06);
  const donk = Math.sin(donkPhase) * dEnv * 0.5;

  L[i] = l + sub + lpL * 0.6 + donk;
  R[i] = r + sub + lpR * 0.6 + donk;
}

// cheap stereo pseudo-reverb tail (a couple of attenuated taps)
function tap(buf, ms, g) {
  const d = Math.floor((SR * ms) / 1000);
  for (let i = buf.length - 1; i >= d; i--) buf[i] += buf[i - d] * g;
}
tap(L, 57, 0.18);
tap(R, 73, 0.18);
tap(L, 113, 0.1);
tap(R, 131, 0.1);

// peak-normalize to -12 dBFS
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const target = Math.pow(10, -12 / 20); // 0.2512
const g = peak > 0 ? target / peak : 1;

// write 16-bit stereo PCM WAV
const buf = Buffer.alloc(44 + N * 4);
let o = 0;
buf.write('RIFF', o); o += 4;
buf.writeUInt32LE(36 + N * 4, o); o += 4;
buf.write('WAVE', o); o += 4;
buf.write('fmt ', o); o += 4;
buf.writeUInt32LE(16, o); o += 4;
buf.writeUInt16LE(1, o); o += 2; // PCM
buf.writeUInt16LE(2, o); o += 2; // stereo
buf.writeUInt32LE(SR, o); o += 4;
buf.writeUInt32LE(SR * 4, o); o += 4; // byte rate
buf.writeUInt16LE(4, o); o += 2; // block align
buf.writeUInt16LE(16, o); o += 2; // bits
buf.write('data', o); o += 4;
buf.writeUInt32LE(N * 4, o); o += 4;
for (let i = 0; i < N; i++) {
  const l = Math.max(-1, Math.min(1, L[i] * g));
  const r = Math.max(-1, Math.min(1, R[i] * g));
  buf.writeInt16LE((l * 32767) | 0, o); o += 2;
  buf.writeInt16LE((r * 32767) | 0, o); o += 2;
}

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'public');
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, 'synth-hit.wav');
writeFileSync(outPath, buf);
console.log(`wrote ${outPath} — ${N} samples, ${DUR}s, peak -12 dBFS`);
