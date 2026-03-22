/**
 * AudioEngine — Tone.js v15 audio synthesis and effects.
 *
 * IMPORTANT Tone.js v15 API notes:
 * - Use Tone.getDestination() NOT Tone.Destination (deprecated)
 * - Use Tone.getTransport() NOT Tone.Transport (deprecated)
 * - Use meter.getValue() NOT meter.getLevel() (deprecated)
 * - Use synth.toDestination() NOT synth.toMaster() (deprecated)
 * - TypeScript types are bundled — no @types/tone needed
 *
 * Master Bus Architecture:
 *   Instruments → Compressor → Limiter(-2dB) → Destination
 *                                    ↓
 *                               Tone.Meter (→ shader u_amplitude)
 *
 * Instruments:
 *   Voice 1: Tone.PluckSynth
 *     - Karplus-Strong string synthesis
 *     - Filter cutoff (dampening) mapped to triangle area
 *     - attackNoise, dampening, resonance, release params
 *
 *   Voice 2: 909 Drum Kit (synthesized, no samples)
 *     - Kick: Tone.MembraneSynth (pitchDecay: 0.05, octaves: 10)
 *     - Snare: Tone.MembraneSynth + Tone.NoiseSynth layered
 *     - Hi-hat: Tone.MetalSynth (harmonicity: 5.1, modulationIndex: 32)
 *     - Distortion amount mapped to triangle area
 *
 *   Voice 3: Sub-Bass
 *     - Tone.Synth with sine oscillator
 *     - LFO rate mapped to triangle area
 *
 * Methods:
 *   start(): Initialize audio context (MUST be called from user gesture)
 *   update(hands): Called per frame with current hand data
 *   panic(): Kill all transport, dispose synths, rebuild (Spacebar)
 *   getAmplitude(): Returns current master output level (0-1) for shader uniform
 *   dispose(): Full cleanup — triggerRelease() → dispose() → null refs
 *
 * Disposal pattern (important for preventing memory leaks):
 *   1. synth.triggerRelease()
 *   2. synth.dispose()
 *   3. synth = null  (allow GC)
 */

import type { TrackedHand } from '../vision/HandTracker';

export class AudioEngine {
  // TODO: Implement

  // Placeholder to prevent TS errors in consumers
  start(): Promise<void> { return Promise.resolve(); }
  update(_hands: TrackedHand[]): void { /* noop */ }
  panic(): void { /* noop */ }
  getAmplitude(): number { return 0; }
  dispose(): void { /* noop */ }
}
