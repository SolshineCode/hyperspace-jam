import { useRef, useEffect } from 'react';
import Visualizer from './components/Visualizer';
import UIOverlay from './components/UIOverlay';
import AttractMode from './components/AttractMode';
import { AudioEngine } from './audio/AudioEngine';
import { HandTracker } from './vision/HandTracker';
import type { TrackedHand } from './vision/HandTracker';
import './App.css';

/**
 * Expected AudioEngine interface — the actual class will implement these methods.
 * Using this interface lets App.tsx compile before AudioEngine is fully implemented.
 */
interface AudioEngineAPI {
  start(): void;
  update(hands: TrackedHand[]): void;
  panic(): void;
  getAmplitude(): number;
  dispose(): void;
}

export default function App() {
  const audioRef = useRef<AudioEngineAPI | null>(null);
  const trackerRef = useRef<HandTracker | null>(null);

  // Create AudioEngine once
  useEffect(() => {
    audioRef.current = new AudioEngine() as unknown as AudioEngineAPI;
    return () => {
      audioRef.current?.dispose();
      audioRef.current = null;
    };
  }, []);

  // Per-frame audio update loop (bridge hand data to audio)
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

  return (
    <>
      <Visualizer />
      <UIOverlay
        onStartAudio={() => audioRef.current?.start()}
        onPanic={() => audioRef.current?.panic()}
      />
      <AttractMode />
    </>
  );
}
