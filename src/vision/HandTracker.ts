/**
 * HandTracker — MediaPipe Hands integration with auto-recovery.
 *
 * Writes landmark data to a mutable object (NOT React state) for 60fps consumption.
 * Consumers read from HandTracker.landmarks directly in their animation loops.
 *
 * TODO: Implement in Step 2
 * - Initialize @mediapipe/hands with maxNumHands: 4
 * - Set up webcam via @mediapipe/camera_utils
 * - Store landmarks in a mutable ref
 * - Compute triangle area from landmarks 4, 8, 20
 * - Auto-reconnect on webcam disconnect (5s interval, max 5 retries)
 */

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface TrackedHand {
  landmarks: HandLandmark[];
  triangleArea: number; // Area of triangle formed by landmarks 4, 8, 20
}

export type LandmarkSubscriber = (hands: TrackedHand[]) => void;

export class HandTracker {
  /** Current frame's tracked hands — read this in useFrame, do NOT subscribe via React state */
  public hands: TrackedHand[] = [];

  private subscribers: LandmarkSubscriber[] = [];

  subscribe(callback: LandmarkSubscriber): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== callback);
    };
  }

  // TODO: init(), start(), stop(), dispose() methods
}
