/**
 * ScaleQuantizer — Maps continuous values to musical scale degrees.
 *
 * TODO: Implement in Step 3
 *
 * Scales:
 *   - C Minor Pentatonic: [0, 3, 5, 7, 10] (intervals from root)
 *   - C Mixolydian: [0, 2, 4, 5, 7, 9, 10]
 *
 * quantize(value: number, scale: ScaleMode): number
 *   - Input: 0.0-1.0 (hand Y position, normalized)
 *   - Output: MIDI note number in range C3 (48) to C5 (72)
 *   - Snaps to nearest note in the active scale
 */

export type ScaleMode = 'pentatonic' | 'mixolydian';

export function quantize(_value: number, _scale: ScaleMode): number {
  // TODO: Implement
  return 60; // Middle C placeholder
}
