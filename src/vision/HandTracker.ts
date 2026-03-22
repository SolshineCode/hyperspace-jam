/**
 * HandTracker — MediaPipe Tasks Vision HandLandmarker with auto-recovery.
 *
 * Writes landmark data to a mutable array (NOT React state) for 60fps consumption.
 * Consumers read from HandTracker.hands directly in their animation loops.
 */

import {
  FilesetResolver,
  HandLandmarker,
} from "@mediapipe/tasks-vision";

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

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

export class HandTracker {
  /** Current frame's tracked hands — read this in useFrame, do NOT subscribe via React state */
  public hands: TrackedHand[] = [];

  private subscribers: LandmarkSubscriber[] = [];
  private handLandmarker: HandLandmarker | null = null;
  private video: HTMLVideoElement | null = null;
  private rafId: number | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;
  private running = false;
  private onError: ((msg: string) => void) | null = null;

  subscribe(callback: LandmarkSubscriber): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== callback);
    };
  }

  setErrorHandler(handler: (msg: string) => void): void {
    this.onError = handler;
  }

  async init(videoElement: HTMLVideoElement): Promise<void> {
    this.video = videoElement;

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
    );

    this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU",
      },
      numHands: 4,
      runningMode: "VIDEO",
      minHandDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    // Watch for webcam disconnects
    const tracks = videoElement.srcObject instanceof MediaStream
      ? videoElement.srcObject.getVideoTracks()
      : [];
    for (const track of tracks) {
      track.addEventListener("ended", () => {
        console.warn("[HandTracker] MediaStreamTrack ended — attempting recovery");
        this.handleDisconnect();
      });
    }
  }

  start(): void {
    if (!this.handLandmarker || !this.video) {
      console.error("[HandTracker] Not initialized — call init() first");
      return;
    }
    this.running = true;
    this.retryCount = 0;
    this.detect();
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  async dispose(): Promise<void> {
    this.stop();
    if (this.handLandmarker) {
      this.handLandmarker.close();
      this.handLandmarker = null;
    }
    this.video = null;
    this.hands = [];
    this.subscribers = [];
  }

  // --- Private ---

  private detect = (): void => {
    if (!this.running || !this.handLandmarker || !this.video) return;

    if (this.video.readyState >= 2) {
      const results = this.handLandmarker.detectForVideo(
        this.video,
        performance.now()
      );

      const newHands: TrackedHand[] = [];
      if (results.landmarks) {
        for (const handLandmarks of results.landmarks) {
          const landmarks: HandLandmark[] = handLandmarks.map((lm) => ({
            x: lm.x,
            y: lm.y,
            z: lm.z,
          }));
          const triangleArea = computeTriangleArea(
            landmarks[4]!,
            landmarks[8]!,
            landmarks[20]!
          );
          newHands.push({ landmarks, triangleArea });
        }
      }

      this.hands = newHands;
      this.notifySubscribers();
    }

    this.rafId = requestAnimationFrame(this.detect);
  };

  private notifySubscribers(): void {
    for (const cb of this.subscribers) {
      cb(this.hands);
    }
  }

  private handleDisconnect(): void {
    this.stop();
    this.retryCount = 0;
    this.attemptRecovery();
  }

  private attemptRecovery(): void {
    if (this.retryCount >= MAX_RETRIES) {
      const msg = `Webcam recovery failed after ${MAX_RETRIES} attempts`;
      console.error(`[HandTracker] ${msg}`);
      this.onError?.(msg);
      return;
    }

    this.retryCount++;
    console.log(
      `[HandTracker] Recovery attempt ${this.retryCount}/${MAX_RETRIES} in ${RETRY_DELAY_MS / 1000}s...`
    );

    this.retryTimer = setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
        });

        if (this.video) {
          this.video.srcObject = stream;
          await this.video.play();

          // Re-attach track ended listener
          for (const track of stream.getVideoTracks()) {
            track.addEventListener("ended", () => {
              console.warn("[HandTracker] MediaStreamTrack ended — attempting recovery");
              this.handleDisconnect();
            });
          }

          this.running = true;
          this.detect();
          console.log("[HandTracker] Recovery successful");
        }
      } catch (err) {
        console.error("[HandTracker] Recovery attempt failed:", err);
        this.attemptRecovery();
      }
    }, RETRY_DELAY_MS);
  }
}

/** Compute area of triangle using the cross-product method (2D, ignoring z). */
function computeTriangleArea(
  a: HandLandmark,
  b: HandLandmark,
  c: HandLandmark
): number {
  return Math.abs(
    (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)) / 2
  );
}
