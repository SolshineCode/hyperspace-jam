// Type shim — @mediapipe/tasks-vision has a malformed exports map
// that bundler moduleResolution can't resolve. Re-export from the actual .d.ts.
declare module "@mediapipe/tasks-vision" {
  export * from "@mediapipe/tasks-vision/vision";
}

declare module "@mediapipe/tasks-vision/vision" {
  export class FilesetResolver {
    static forVisionTasks(basePath: string): Promise<WasmFileset>;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface WasmFileset {}

  export interface HandLandmarkerOptions {
    baseOptions?: {
      modelAssetPath?: string;
      delegate?: "CPU" | "GPU";
    };
    numHands?: number;
    runningMode?: "IMAGE" | "VIDEO";
    minHandDetectionConfidence?: number;
    minTrackingConfidence?: number;
  }

  export interface NormalizedLandmark {
    x: number;
    y: number;
    z: number;
    visibility?: number;
  }

  export interface HandLandmarkerResult {
    landmarks: NormalizedLandmark[][];
    worldLandmarks: NormalizedLandmark[][];
    handednesses: { categoryName: string; score: number }[][];
  }

  export class HandLandmarker {
    static createFromOptions(
      fileset: WasmFileset,
      options: HandLandmarkerOptions
    ): Promise<HandLandmarker>;
    detectForVideo(
      video: HTMLVideoElement,
      timestamp: number
    ): HandLandmarkerResult;
    close(): void;
  }
}
