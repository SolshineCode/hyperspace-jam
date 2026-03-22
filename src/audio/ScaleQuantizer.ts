/**
 * ScaleQuantizer — Maps continuous values to musical scale degrees.
 *
 * Scales:
 *   - C Minor Pentatonic: [0, 3, 5, 7, 10] (intervals from root)
 *   - C Mixolydian: [0, 2, 4, 5, 7, 9, 10]
 *
 * quantize(value, scale): number
 *   - Input: 0.0-1.0 (hand Y position, normalized)
 *   - Output: MIDI note number in range C3 (48) to C5 (72)
 *   - Snaps to nearest note in the active scale
 */

export type ScaleMode = 'pentatonic' | 'mixolydian';

const SCALES: Record<ScaleMode, number[]> = {
  pentatonic: [0, 3, 5, 7, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

const MIDI_LOW = 48; // C3
const MIDI_HIGH = 72; // C5

/**
 * Build all MIDI notes in the given scale between MIDI_LOW and MIDI_HIGH.
 */
function buildScaleNotes(scale: ScaleMode): number[] {
  const intervals = SCALES[scale];
  const notes: number[] = [];
  for (let octave = 0; octave <= 3; octave++) {
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
 * Map a 0-1 value to the nearest MIDI note in the active scale.
 */
export function quantize(value: number, scale: ScaleMode): number {
  const clamped = Math.max(0, Math.min(1, value));
  const notes = buildScaleNotes(scale);
  const rawMidi = MIDI_LOW + clamped * (MIDI_HIGH - MIDI_LOW);

  let closest = notes[0];
  let minDist = Math.abs(rawMidi - closest);
  for (let i = 1; i < notes.length; i++) {
    const dist = Math.abs(rawMidi - notes[i]);
    if (dist < minDist) {
      minDist = dist;
      closest = notes[i];
    }
  }
  return closest;
}

/**
 * Convert a MIDI note number to frequency in Hz.
 */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
