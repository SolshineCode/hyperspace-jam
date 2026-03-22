/**
 * HandTracker — MediaPipe Tasks Vision HandLandmarker integration with auto-recovery.
 *
 * Uses @mediapipe/tasks-vision (NOT the legacy @mediapipe/hands which is EOL).
 * Writes landmark data to a mutable object (NOT React state) for 60fps consumption.
 * Consumers read from HandTracker.hands directly in their animation loops.
 *
 * Implementation guide:
 *
 * 1. Initialize with FilesetResolver + HandLandmarker.createFromOptions():
 *    - WASM: https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm
 *    - Model: https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
 *    - numHands: 4, runningMode: "VIDEO", delegate: "GPU"
 *
 * 2. Webcam setup: use native navigator.mediaDevices.getUserMedia()
 *    (do NOT use @mediapipe/camera_utils — not needed with tasks-vision)
 *
 * 3. Detection loop: call handLandmarker.detectForVideo(video, timestamp) in rAF
 *    - Returns results synchronously (no callback pattern)
 *    - Write directly to this.hands (mutable, no React re-render)
 *
 * 4. Auto-recovery: on webcam error/disconnect, retry every 5s, max 5 retries
 *
 * 5. Triangle area: compute from landmarks[4], landmarks[8], landmarks[20]
 *    using the cross product formula: area = 0.5 * |AB × AC|
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

/**
 * Compute triangle area from three 2D points using cross product.
 * Uses only x,y since we're mapping to screen space.
 */
export function computeTriangleArea(
  a: HandLandmark,
  b: HandLandmark,
  c: HandLandmark
): number {
  return 0.5 * Math.abs(
    (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)
  );
}

export class HandTracker {
  /** Current frame's tracked hands — read this in useFrame, do NOT subscribe via React state */
  public hands: TrackedHand[] = [];

  private subscribers: LandmarkSubscriber[] = [];
  private animationFrameId: number | null = null;
  private retryCount = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  static readonly MAX_RETRIES = 5;
  static readonly RETRY_INTERVAL_MS = 5000;

  subscribe(callback: LandmarkSubscriber): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== callback);
    };
  }

  private notifySubscribers(): void {
    for (const sub of this.subscribers) {
      sub(this.hands);
    }
  }

  // TODO: Implement these methods (stubs for type-checking)

  async init(_videoElement: HTMLVideoElement): Promise<void> {
    // Initialize FilesetResolver + HandLandmarker
  }

  start(): void {
    const detect = () => {
      this.notifySubscribers();
      this.animationFrameId = requestAnimationFrame(detect);
    };
    detect();
  }

  stop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  async dispose(): Promise<void> {
    this.stop();
    this.resetRetries();
  }

  private resetRetries(): void {
    this.retryCount = 0;
  }

  get retriesExhausted(): boolean {
    return this.retryCount >= HandTracker.MAX_RETRIES;
  }
}
