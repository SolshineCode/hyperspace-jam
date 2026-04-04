import { useRef, useEffect, useCallback } from 'react';
import { HandTrackerProvider, useHandTracker } from './components/HandTrackerProvider';
import Visualizer from './components/Visualizer';
import UIOverlay from './components/UIOverlay';
import AttractMode from './components/AttractMode';
import { AudioEngine } from './audio/AudioEngine';
import type { HandTracker } from './vision/HandTracker';
import type { TrackedHand } from './vision/HandTracker';
import './App.css';

interface AudioEngineAPI {
  start(): Promise<void>;
  update(hands: TrackedHand[]): void;
  panic(): void;
  getAmplitude(): number;
  dispose(): void;
}

function AppInner() {
  const audioRef = useRef<AudioEngineAPI | null>(null);
  const { tracker, startTracking } = useHandTracker();
  const trackerRef = useRef<HandTracker | null>(null);

  // Keep trackerRef in sync with context value
  trackerRef.current = tracker;

  // Create AudioEngine once
  useEffect(() => {
    audioRef.current = new AudioEngine() as unknown as AudioEngineAPI;
    return () => {
      audioRef.current?.dispose();
      audioRef.current = null;
    };
  }, []);

  // Per-frame audio update loop + attract mode amplitude override
  useEffect(() => {
    let rafId: number;
    function loop() {
      if (audioRef.current && trackerRef.current) {
        audioRef.current.update(trackerRef.current.hands);
      }
      rafId = requestAnimationFrame(loop);
    }
    loop();
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Combined start: webcam + audio (both need user gesture)
  const handleStart = useCallback(async () => {
    await startTracking();
    await audioRef.current?.start();
  }, [startTracking]);

  return (
    <>
      <Visualizer
        trackerRef={trackerRef}
        audioRef={audioRef as React.RefObject<AudioEngineAPI | null>}
      />
      <UIOverlay
        onStartAudio={handleStart}
        onPanic={() => audioRef.current?.panic()}
      />
      <AttractMode />
    </>
  );
}

export default function App() {
  return (
    <HandTrackerProvider>
      <AppInner />
    </HandTrackerProvider>
  );
}
