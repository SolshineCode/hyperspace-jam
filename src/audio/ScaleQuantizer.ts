/**
 * ScaleQuantizer — Maps continuous hand position values to musical scale degrees.
 *
 * Scales (intervals from root C):
 *   C Minor Pentatonic: [0, 3, 5, 7, 10]  → C, Eb, F, G, Bb
 *   C Mixolydian:       [0, 2, 4, 5, 7, 9, 10] → C, D, E, F, G, A, Bb
 *
 * quantize(value, scale):
 *   Input: 0.0-1.0 (hand Y position, normalized — 0=top, 1=bottom)
 *   Output: MIDI note number in range C3 (48) to C5 (72)
 *   Behavior: Maps input linearly to the note range, snaps to nearest scale degree
 *
 * midiToFrequency(midi):
 *   Standard 440Hz tuning: freq = 440 * 2^((midi-69)/12)
 *
 * midiToNoteName(midi):
 *   Returns string like "C4", "Eb3", etc. for debug display
 */

export type ScaleMode = 'pentatonic' | 'mixolydian';

const SCALES: Record<ScaleMode, number[]> = {
  pentatonic: [0, 3, 5, 7, 10],   // C minor pentatonic
  mixolydian: [0, 2, 4, 5, 7, 9, 10], // C mixolydian
};

const MIDI_LOW = 48;  // C3
const MIDI_HIGH = 72; // C5

/**
 * Generate all MIDI notes in the given scale across the C3-C5 range.
 */
function getScaleNotes(scale: ScaleMode): number[] {
  const intervals = SCALES[scale];
  const notes: number[] = [];
  for (let octave = 0; octave <= 2; octave++) {
    for (const interval of intervals) {
      const midi = MIDI_LOW + octave * 12 + interval;
      if (midi >= MIDI_LOW && midi <= MIDI_HIGH) {
        notes.push(midi);
      }
    }
  }
  return notes;
}

/**
 * Map a continuous 0-1 value to the nearest MIDI note in the active scale.
 */
export function quantize(value: number, scale: ScaleMode): number {
  const clamped = Math.max(0, Math.min(1, value));
  const notes = getScaleNotes(scale);
  // Map 0-1 to index range
  const index = Math.round(clamped * (notes.length - 1));
  return notes[index];
}

/**
 * Convert MIDI note number to frequency (A440 tuning).
 */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
