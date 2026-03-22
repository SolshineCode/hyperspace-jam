/**
 * AudioEngine — Tone.js audio synthesis and effects.
 *
 * TODO: Implement in Step 3
 *
 * Master Bus: Compressor → Limiter(-2dB) → Destination
 * Instruments:
 *   - Voice 1: PluckSynth (filter cutoff mapped to triangle area)
 *   - Voice 2: 909 Drum Kit (distortion mapped to triangle area)
 *   - Voice 3: Sub-Bass Synth (LFO rate mapped to triangle area)
 *
 * Methods:
 *   - start(): Initialize audio context (must be called from user gesture)
 *   - update(hands): Called per frame with current hand data
 *   - panic(): Kill all transport, dispose synths, rebuild (Spacebar)
 *   - getAmplitude(): Returns current master output level for shader uniform
 *   - dispose(): Full cleanup
 */

export class AudioEngine {
  // TODO: Implement
}
