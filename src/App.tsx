import { useRef, useEffect, useCallback } from 'react';
import { HandTrackerProvider, useHandTracker } from './components/HandTrackerProvider';
import Visualizer from './components/Visualizer';
import UIOverlay from './components/UIOverlay';
import AttractMode from './components/AttractMode';
import { AudioEngine } from './audio/AudioEngine';
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

  // Create AudioEngine once
  useEffect(() => {
    audioRef.current = new AudioEngine() as unknown as AudioEngineAPI;
    return () => {
      audioRef.current?.dispose();
      audioRef.current = null;
    };
  }, []);

  // Per-frame audio update loop
  useEffect(() => {
    let rafId: number;
    function loop() {
      if (audioRef.current && tracker) {
        audioRef.current.update(tracker.hands);
      }
      rafId = requestAnimationFrame(loop);
    }
    loop();
    return () => cancelAnimationFrame(rafId);
  }, [tracker]);

  // Combined start: webcam + audio (both need user gesture)
  const handleStart = useCallback(async () => {
    await startTracking();
    await audioRef.current?.start();
  }, [startTracking]);

  return (
    <>
      <Visualizer />
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
