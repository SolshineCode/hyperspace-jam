/**
 * HandTrackerProvider — React wrapper that manages webcam + HandTracker lifecycle.
 *
 * Creates a hidden <video> element, acquires the webcam, initializes the
 * HandTracker, and provides it via context. Bridges discrete state changes
 * (hands detected yes/no) to the zustand store.
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { HandTracker } from "../vision/HandTracker";
import { useAppStore } from "../store/useAppStore";

interface HandTrackerContextValue {
  tracker: HandTracker | null;
  /** Call this from a user gesture (click) to request webcam + start tracking */
  startTracking: () => Promise<void>;
}

const HandTrackerContext = createContext<HandTrackerContextValue>({
  tracker: null,
  startTracking: async () => {},
});

export function useHandTracker(): HandTrackerContextValue {
  return useContext(HandTrackerContext);
}

export function HandTrackerProvider({ children }: { children: ReactNode }) {
  const trackerRef = useRef<HandTracker | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);
  const disposedRef = useRef(false);
  const setHandsDetected = useAppStore((s) => s.setHandsDetected);
  const setWebcamError = useAppStore((s) => s.setWebcamError);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disposedRef.current = true;
      if (trackerRef.current) {
        void trackerRef.current.dispose();
      }
      const video = videoRef.current;
      if (video?.srcObject instanceof MediaStream) {
        for (const track of video.srcObject.getTracks()) {
          track.stop();
        }
      }
    };
  }, []);

  // Called from user gesture (Click to Start button) so getUserMedia works in iframes
  const startTracking = useRef(async () => {
    if (ready || disposedRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });

      if (disposedRef.current) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;
      await video.play();

      const tracker = new HandTracker();
      trackerRef.current = tracker;

      await tracker.init(video);

      // Bridge discrete hand-detection state to zustand
      let prevDetected = false;
      tracker.subscribe((hands) => {
        const detected = hands.length > 0;
        if (detected !== prevDetected) {
          prevDetected = detected;
          setHandsDetected(detected);
        }
      });

      tracker.setErrorHandler((msg) => {
        setWebcamError(msg);
      });

      tracker.start();
      setReady(true);
    } catch (err) {
      console.error("[HandTrackerProvider] Setup failed:", err);
      setWebcamError(
        err instanceof Error ? err.message : "Webcam setup failed"
      );
    }
  }).current;

  return (
    <HandTrackerContext.Provider
      value={{ tracker: ready ? trackerRef.current : null, startTracking }}
    >
      <video
        ref={videoRef}
        style={{ display: "none" }}
        playsInline
        muted
      />
      {children}
    </HandTrackerContext.Provider>
  );
}
