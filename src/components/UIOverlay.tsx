import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';

interface UIOverlayProps {
  onStartAudio: () => void | Promise<void>;
  onPanic: () => void;
}

export default function UIOverlay({ onStartAudio, onPanic }: UIOverlayProps) {
  const audioStarted = useAppStore((s) => s.audioStarted);
  const scaleMode = useAppStore((s) => s.scaleMode);
  const webcamError = useAppStore((s) => s.webcamError);
  const [panicFlash, setPanicFlash] = useState(false);

  const handleStart = useCallback(() => {
    onStartAudio();
  }, [onStartAudio]);

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        onPanic();
        setPanicFlash(true);
        setTimeout(() => setPanicFlash(false), 200);
      }
    }
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [onPanic]);

  return (
    <div className="ui-overlay">
      {!audioStarted && (
        <button className="start-button" onClick={handleStart}>
          Click to Start
        </button>
      )}

      <button
        className="scale-toggle"
        onClick={() => useAppStore.getState().toggleScale()}
      >
        {scaleMode === 'pentatonic' ? 'PENTATONIC' : 'MIXOLYDIAN'}
      </button>

      <div className="webcam-status">
        <div className={`webcam-dot ${webcamError ? 'error' : 'active'}`} />
        {webcamError && <span>{webcamError}</span>}
      </div>

      {panicFlash && <div className="panic-flash" />}
    </div>
  );
}
