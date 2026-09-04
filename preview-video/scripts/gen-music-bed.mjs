// Pre-renders the music bed (public/music-bed.wav). Dependency-free procedural
// synthesis: a 105 BPM sports/trap groove in A minor (harmonically compatible
// with the C-major synth hit so the hit reads as a triumphant resolution).
// Builds through the mechanic shots, then HALF-TIME DROP at the celebration so
// the -12 dBFS synth hit punches cleanly through the -18 dBFS bed.
//
// Placed at 0:01 in the composition; this WAV is 26s -> ends at 0:27, leaving
// the 0:27-0:30 compliance card clean. Peak-normalized to -18 dBFS.
//
// Section map (music-relative seconds; global = +1s):
//   0.0-2.0   intro     (title card)
//   2.0-5.5   build A   (build lineup)
//   5.5-9.5   build B   (lock)
//   9.5-13.5  build C + riser 11.5-13.5 (leaderboard)
//   13.5-18.5 DROP / half-time (celebration) — impact at 13.5
//   18.5-26.0 outro     (brand close), fade 24-26
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const SR = 44100;
const DUR = 26.0;
const N = Math.floor(SR * DUR);

const BPM = 105;
const beat = 60 / BPM;
const step = beat / 4; // 16th
const bar = beat * 4;
const eighth = beat / 2;

const ROOTS = [110.0, 110.0, 87.31, 98.0]; // A2 A2 F2 G2
const LEAD = [440.0, 523.25, 587.33, 659.25]; // A4 C5 D5 E5 (A-minor pentatonic)

// 16-step patterns
const KICK = [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0];
const HALFKICK = [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0];
const SNARE = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
const HALFSNARE = [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0];
const HAT = [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1];
const OPENHAT = [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1];
const LEADPAT = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];

// deterministic noise
let seed = 20240601;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return (seed / 0x7fffffff) * 2 - 1;
};

const ramp = (a, b, x) => (x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a));

function sect(t) {
  const drop = t >= 13.5 && t < 18.5;
  const outro = t >= 18.5;
  let kick = 0.5 + 0.5 * ramp(0, 4, t);
  let hat = ramp(2, 5.5, t);
  let snare = ramp(5.5, 7.5, t);
  let bass = ramp(1.5, 5.5, t);
  let lead = t >= 5.5 && t < 13.5 ? ramp(5.5, 7, t) : 0;
  let riser = t >= 11.5 && t < 13.5 ? ramp(11.5, 13.5, t) : 0;
  let halftime = drop ? 1 : 0;
  if (drop) {
    hat *= 0.18;
    snare *= 0.45;
    bass = 0.85;
    lead = 0;
    kick = 1;
  }
  if (outro) {
    const fade = 1 - ramp(24, 26, t);
    kick = 0.85 * fade;
    hat = 0.5 * fade;
    snare = 0.7 * fade;
    bass = 0.72 * fade;
    lead = 0.7 * fade;
    riser = 0;
    halftime = 0;
  }
  return { kick, hat, snare, bass, lead, riser, halftime };
}

// --- voices ---
function kickAt(dt) {
  if (dt < 0 || dt > 0.34) return 0;
  const f = 48 + 92 * Math.exp(-dt * 24);
  const env = Math.exp(-dt * 8.5);
  const click = dt < 0.006 ? rnd() * 0.5 * Math.exp(-dt * 220) : 0;
  return Math.sin(2 * Math.PI * f * dt) * env + click;
}
function snareAt(dt) {
  if (dt < 0 || dt > 0.22) return 0;
  const env = Math.exp(-dt * 22);
  const tone = Math.sin(2 * Math.PI * 185 * dt) * 0.35 + Math.sin(2 * Math.PI * 330 * dt) * 0.2;
  return (rnd() * 0.9 + tone) * env;
}
function hatAt(dt, open) {
  const len = open ? 0.14 : 0.05;
  if (dt < 0 || dt > len) return 0;
  return rnd() * Math.exp(-dt / (len * 0.32));
}
function bassOsc(t, f) {
  const w = 2 * Math.PI * f * t;
  return Math.sin(w) + 0.4 * Math.sin(2 * w) + 0.25 * Math.sin(3 * w) + 0.15 * Math.sin(4 * w);
}
function leadAt(dt, f) {
  if (dt < 0 || dt > 0.5) return 0;
  const env = (1 - Math.exp(-dt * 120)) * Math.exp(-dt * 6);
  const tone =
    Math.sin(2 * Math.PI * f * dt) +
    0.5 * Math.sin(2 * Math.PI * 2 * f * dt) +
    0.25 * Math.sin(2 * Math.PI * 3 * f * dt);
  return tone * env * 0.5;
}
function impactAt(dt) {
  // big drop boom + crash at t=13.5
  if (dt < 0 || dt > 1.5) return 0;
  const boom = Math.sin(2 * Math.PI * 52 * dt) * Math.exp(-dt * 3.2) * 0.95;
  const crash = rnd() * Math.exp(-dt * 4.5) * 0.4;
  return boom + crash;
}

const L = new Float64Array(N);
const R = new Float64Array(N);

let lastKick = -1;
let lastSnare = -1;
let lastHat = -1;
let lastHatOpen = false;
let lastLead = -1;
let leadFreq = 440;
let prevStep = -1;
let lpBass = 0;

for (let i = 0; i < N; i++) {
  const t = i / SR;
  const absStep = Math.floor(t / step);
  const stepInBar = ((absStep % 16) + 16) % 16;
  const barIdx = Math.floor(t / bar) % 4;
  const s = sect(t);

  if (absStep !== prevStep) {
    prevStep = absStep;
    const kp = s.halftime ? HALFKICK : KICK;
    const sp = s.halftime ? HALFSNARE : SNARE;
    if (kp[stepInBar]) lastKick = t;
    if (sp[stepInBar]) lastSnare = t;
    if (!s.halftime && HAT[stepInBar] && s.hat > 0.01) {
      lastHat = t;
      lastHatOpen = OPENHAT[stepInBar] === 1;
    }
    if (LEADPAT[stepInBar] && s.lead > 0.01) {
      lastLead = t;
      leadFreq = LEAD[Math.floor(absStep / 2) % LEAD.length];
    }
  }

  // sidechain duck on kick (pump)
  const duck = lastKick >= 0 ? 1 - 0.5 * Math.exp(-(t - lastKick) * 12) : 1;

  const kick = kickAt(t - lastKick) * 0.95 * s.kick;
  const snare = snareAt(t - lastSnare) * 0.62 * s.snare;
  const hat = hatAt(t - lastHat, lastHatOpen) * 0.32 * s.hat;

  // bass: continuous osc at bar root, 8th-note pluck env, lowpassed, ducked
  const root = ROOTS[barIdx];
  const dtE = t % eighth;
  const bEnv = (1 - Math.exp(-dtE * 90)) * Math.exp(-dtE * 4.2);
  const bassRaw = bassOsc(t, root) * bEnv;
  lpBass += 0.18 * (bassRaw - lpBass);
  const bass = lpBass * 0.5 * s.bass * duck;

  const lead = leadAt(t - lastLead, leadFreq) * 0.28 * s.lead * duck;

  // riser: rising pitch + noise crescendo into the drop
  let riser = 0;
  if (s.riser > 0) {
    const fr = 150 + 1650 * s.riser;
    riser = (Math.sin(2 * Math.PI * fr * t) * 0.4 + rnd() * 0.6) * s.riser * 0.3;
  }

  const impact = impactAt(t - 13.5) * 0.7;

  // mono core + light stereo on hats / lead / riser
  const mono = kick + snare + bass + impact;
  const panHat = stepInBar % 2 === 0 ? 1 : -1;
  let l = mono + hat * (panHat > 0 ? 1 : 0.5) + lead * 0.55 + riser * 0.85;
  let r = mono + hat * (panHat > 0 ? 0.5 : 1) + lead * 0.7 + riser;

  // soft saturation for glue
  l = Math.tanh(l * 0.9);
  r = Math.tanh(r * 0.9);

  L[i] = l;
  R[i] = r;
}

// peak-normalize to -18 dBFS
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const target = Math.pow(10, -18 / 20); // 0.12589
const g = peak > 0 ? target / peak : 1;

const buf = Buffer.alloc(44 + N * 4);
let o = 0;
buf.write('RIFF', o); o += 4;
buf.writeUInt32LE(36 + N * 4, o); o += 4;
buf.write('WAVE', o); o += 4;
buf.write('fmt ', o); o += 4;
buf.writeUInt32LE(16, o); o += 4;
buf.writeUInt16LE(1, o); o += 2;
buf.writeUInt16LE(2, o); o += 2;
buf.writeUInt32LE(SR, o); o += 4;
buf.writeUInt32LE(SR * 4, o); o += 4;
buf.writeUInt16LE(4, o); o += 2;
buf.writeUInt16LE(16, o); o += 2;
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
const outPath = resolve(outDir, 'music-bed.wav');
writeFileSync(outPath, buf);
console.log(`wrote ${outPath} — ${DUR}s, 105 BPM, peak -18 dBFS`);
