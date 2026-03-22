import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';

export default function AttractMode() {
  const handsDetected = useAppStore((s) => s.handsDetected);
  const attractMode = useAppStore((s) => s.attractMode);
  const setAttractMode = useAppStore((s) => s.setAttractMode);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (handsDetected) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setAttractMode(false);
    } else {
      timerRef.current = setTimeout(() => {
        setAttractMode(true);
      }, 30_000);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [handsDetected, setAttractMode]);

  if (!attractMode) return null;

  return (
    <div className="attract-mode">
      <div className="attract-text">STEP UP TO PLAY</div>
    </div>
  );
}
