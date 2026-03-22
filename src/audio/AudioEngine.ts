/**
 * AudioEngine — Tone.js v15 audio synthesis with 3 voices, master bus safety, and panic button.
 *
 * Master Bus: Instruments → Compressor → Limiter(-2dB) → Destination
 *                                              ↓
 *                                         Tone.Meter
 *
 * Voice 1: PluckSynth (hand 0) — dampening mapped to triangleArea, pitch from index finger Y
 * Voice 2: 909 Drum Kit (hand 1) — kick/snare/hihat zones, distortion from triangleArea
 * Voice 3: Sub-Bass Synth (hand 2/3) — LFO rate from triangleArea, low pitch range
 */

import * as Tone from 'tone';
import { type TrackedHand } from '../vision/HandTracker';
import { quantize, midiToFrequency } from './ScaleQuantizer';
import { useAppStore } from '../store/useAppStore';

type DrumZone = 'kick' | 'snare' | 'hihat' | null;

export class AudioEngine {
  // Master bus
  private compressor: Tone.Compressor | null = null;
  private limiter: Tone.Limiter | null = null;
  private meter: Tone.Meter | null = null;

  // Voice 1: Pluck
  private pluck: Tone.PluckSynth | null = null;

  // Voice 2: 909 Drums
  private kick: Tone.MembraneSynth | null = null;
  private snareBody: Tone.MembraneSynth | null = null;
  private snareNoise: Tone.NoiseSynth | null = null;
  private hihat: Tone.MetalSynth | null = null;
  private drumDistortion: Tone.Distortion | null = null;

  // Voice 3: Sub-Bass
  private subBass: Tone.Synth | null = null;
  private lfo: Tone.LFO | null = null;

  // State tracking
  private lastPluckTime = 0;
  private lastDrumZone: DrumZone = null;
  private subBassActive = false;

  async start(): Promise<void> {
    await Tone.start();

    // Master bus
    this.compressor = new Tone.Compressor({
      threshold: -24,
      ratio: 12,
      attack: 0.003,
      release: 0.25,
      knee: 30,
    });
    this.limiter = new Tone.Limiter(-2);
    this.meter = new Tone.Meter({ normalRange: true });

    // Chain: compressor → limiter → destination
    this.compressor.connect(this.limiter);
    this.limiter.connect(Tone.getDestination());
    this.limiter.connect(this.meter);

    this.buildInstruments();

    useAppStore.getState().setAudioStarted(true);
  }

  private buildInstruments(): void {
    if (!this.compressor) return;

    // Voice 1: Pluck
    this.pluck = new Tone.PluckSynth({
      attackNoise: 1,
      dampening: 4000,
      resonance: 0.7,
      release: 1,
    }).connect(this.compressor);

    // Voice 2: 909 Drums — route through distortion
    this.drumDistortion = new Tone.Distortion(0).connect(this.compressor);

    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 10,
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.001,
        decay: 0.4,
        sustain: 0.01,
        release: 1.4,
        attackCurve: 'exponential',
      },
    }).connect(this.drumDistortion);

    this.snareBody = new Tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 4,
      envelope: {
        attack: 0.0006,
        decay: 0.25,
        sustain: 0,
        release: 0.3,
      },
    }).connect(this.drumDistortion);

    this.snareNoise = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: {
        attack: 0.0005,
        decay: 0.15,
        sustain: 0,
        release: 0.1,
      },
    }).connect(this.drumDistortion);

    this.hihat = new Tone.MetalSynth({
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
      envelope: {
        attack: 0.001,
        decay: 0.1,
        release: 0.01,
        sustain: 0,
      },
      volume: -15,
    }).connect(this.drumDistortion);

    // Voice 3: Sub-Bass
    this.subBass = new Tone.Synth({
      oscillator: { type: 'sine' },
    }).connect(this.compressor);

    this.lfo = new Tone.LFO({
      frequency: 1,
      min: -20,
      max: 20,
    });
    this.lfo.connect(this.subBass.detune);
    this.lfo.start();
  }

  update(hands: TrackedHand[]): void {
    const scaleMode = useAppStore.getState().scaleMode;
    const now = performance.now();

    // Voice 1: Pluck — controlled by hands[0]
    if (hands[0] && this.pluck) {
      const area = hands[0].triangleArea;
      this.pluck.dampening = 200 + area * 78000;

      if (now - this.lastPluckTime > 100) {
        const midi = quantize(1 - hands[0].landmarks[8].y, scaleMode);
        const freq = midiToFrequency(midi);
        this.pluck.triggerAttack(freq);
        this.lastPluckTime = now;
      }
    }

    // Voice 2: 909 Drums — controlled by hands[1]
    if (hands[1]) {
      if (this.drumDistortion) {
        this.drumDistortion.wet.value = Math.min(hands[1].triangleArea * 8, 0.8);
      }

      const y = hands[1].landmarks[8].y;
      let zone: DrumZone;
      if (y < 0.33) {
        zone = 'kick';
      } else if (y < 0.66) {
        zone = 'snare';
      } else {
        zone = 'hihat';
      }

      if (zone !== this.lastDrumZone) {
        this.lastDrumZone = zone;
        const time = Tone.now();
        if (zone === 'kick' && this.kick) {
          this.kick.triggerAttackRelease('C1', '8n', time);
        } else if (zone === 'snare') {
          this.snareBody?.triggerAttackRelease('G3', '16n', time);
          this.snareNoise?.triggerAttackRelease('16n', time);
        } else if (zone === 'hihat' && this.hihat) {
          this.hihat.triggerAttackRelease('C4', '32n', time);
        }
      }
    } else {
      this.lastDrumZone = null;
    }

    // Voice 3: Sub-Bass — controlled by hands[2] or hands[3]
    const subHand = hands[2] ?? hands[3];
    if (subHand && this.subBass && this.lfo) {
      // LFO rate from triangleArea
      this.lfo.frequency.value = 0.1 + subHand.triangleArea * 79; // 0.1–8 Hz range

      if (!this.subBassActive) {
        // Low pitch range: MIDI 24–36 (C1–C2)
        const rawMidi = 24 + (1 - subHand.landmarks[8].y) * 12;
        const midi = Math.round(Math.max(24, Math.min(36, rawMidi)));
        const freq = midiToFrequency(midi);
        this.subBass.triggerAttack(freq);
        this.subBassActive = true;
      }
    } else if (this.subBassActive && this.subBass) {
      this.subBass.triggerRelease();
      this.subBassActive = false;
    }
  }

  panic(): void {
    Tone.getTransport().stop();
    Tone.getTransport().cancel();

    this.disposeInstruments();
    this.buildInstruments();
  }

  getAmplitude(): number {
    return (this.meter?.getValue() as number) ?? 0;
  }

  dispose(): void {
    Tone.getTransport().stop();
    this.disposeInstruments();

    this.compressor?.dispose();
    this.compressor = null;
    this.limiter?.dispose();
    this.limiter = null;
    this.meter?.dispose();
    this.meter = null;
  }

  private disposeInstruments(): void {
    // Pluck (self-decaying, no triggerRelease)
    this.pluck?.dispose();
    this.pluck = null;

    // Drums
    this.kick?.dispose();
    this.kick = null;
    this.snareBody?.dispose();
    this.snareBody = null;
    this.snareNoise?.dispose();
    this.snareNoise = null;
    this.hihat?.dispose();
    this.hihat = null;
    this.drumDistortion?.dispose();
    this.drumDistortion = null;

    // Sub-Bass
    if (this.subBassActive && this.subBass) {
      this.subBass.triggerRelease();
    }
    this.lfo?.stop();
    this.lfo?.dispose();
    this.lfo = null;
    this.subBass?.dispose();
    this.subBass = null;
    this.subBassActive = false;

    this.lastDrumZone = null;
    this.lastPluckTime = 0;
  }
}
