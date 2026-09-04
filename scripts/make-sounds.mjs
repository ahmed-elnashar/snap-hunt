#!/usr/bin/env node
/**
 * Generates the app's two sounds into assets/audio/.
 *
 * They are synthesised by this script rather than taken from a sound library so
 * their provenance and licence are unambiguous: they are outputs of code in
 * this repository. Re-run with `node scripts/make-sounds.mjs`.
 *
 * DESIGN.md allows at most two sounds and specifies these:
 *   shutter — a mechanical clack. The submission left your hands.
 *   stamp   — wood on paper. The loudest thing in the app, at the one moment
 *             that deserves it.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 44_100;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'audio');

/** Deterministic noise, so re-running produces byte-identical files. */
function makeNoise(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return (s / 0xffffffff) * 2 - 1;
  };
}

/** One-pole low-pass, for taking the fizz off a noise burst. */
function lowpass(cutoffHz) {
  const a = Math.exp((-2 * Math.PI * cutoffHz) / RATE);
  let last = 0;
  return (x) => {
    last = x * (1 - a) + last * a;
    return last;
  };
}

function writeWav(name, samples) {
  const pcm = Buffer.alloc(samples.length * 2);
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const gain = peak > 0 ? 0.89 / peak : 0;
  for (let i = 0; i < samples.length; i += 1) {
    const v = Math.max(-1, Math.min(1, samples[i] * gain));
    pcm.writeInt16LE(Math.round(v * 32767), i * 2);
  }

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);

  mkdirSync(OUT, { recursive: true });
  const path = join(OUT, name);
  writeFileSync(path, Buffer.concat([header, pcm]));
  console.log(
    `${name}  ${(pcm.length / 2 / RATE).toFixed(3)}s  ${pcm.length + 44} bytes`,
  );
}

/**
 * Shutter: two closely spaced mechanical transients — the mirror, then the
 * blade — over a short filtered noise burst. Dry and unmusical on purpose.
 */
function shutter() {
  const length = Math.round(RATE * 0.11);
  const noise = makeNoise(0x5eed_1001);
  const lp = lowpass(3800);
  const out = new Float32Array(length);

  const hits = [
    { at: 0, decay: 340, level: 1 },
    { at: Math.round(RATE * 0.028), decay: 260, level: 0.72 },
  ];

  for (let i = 0; i < length; i += 1) {
    const t = i / RATE;
    let v = 0;
    for (const hit of hits) {
      if (i < hit.at) continue;
      const dt = (i - hit.at) / RATE;
      const env = Math.exp(-dt * hit.decay);
      // Filtered noise gives the body; a short 2.1 kHz ring gives the metal.
      v +=
        hit.level * env * (lp(noise()) * 1.6 + Math.sin(2 * Math.PI * 2100 * dt) * 0.28);
    }
    // Gentle fade to zero so the tail cannot click on some devices.
    out[i] = v * Math.min(1, (length - i) / (RATE * 0.008));
    void t;
  }
  return out;
}

/**
 * Stamp: a wooden thump. A low body that drops in pitch as it lands, a mid
 * resonance for the block, and a short noise transient for the paper.
 */
function stamp() {
  const length = Math.round(RATE * 0.26);
  const noise = makeNoise(0x5eed_2002);
  const lp = lowpass(2200);
  const out = new Float32Array(length);

  for (let i = 0; i < length; i += 1) {
    const t = i / RATE;
    // Pitch drop: 150 Hz settling to 78 Hz within about 40 ms.
    const f = 78 + 72 * Math.exp(-t * 26);
    const body = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 19);
    const block = Math.sin(2 * Math.PI * 396 * t) * Math.exp(-t * 46) * 0.34;
    const paper = lp(noise()) * Math.exp(-t * 150) * 0.5;
    out[i] = (body + block + paper) * Math.min(1, (length - i) / (RATE * 0.02));
  }
  return out;
}

writeWav('shutter.wav', shutter());
writeWav('stamp.wav', stamp());
