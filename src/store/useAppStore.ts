/**
 * Zustand global app store.
 *
 * IMPORTANT: This store is ONLY for discrete application state.
 * Do NOT store 60fps hand landmark coordinates here — use useRef instead.
 */

import { create } from 'zustand';

export type ScaleMode = 'pentatonic' | 'mixolydian';

interface AppState {
  handsDetected: boolean;
  audioStarted: boolean;
  scaleMode: ScaleMode;
  attractMode: boolean;
  webcamError: string | null;

  setHandsDetected: (detected: boolean) => void;
  setAudioStarted: (started: boolean) => void;
  toggleScale: () => void;
  setAttractMode: (active: boolean) => void;
  setWebcamError: (error: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  handsDetected: false,
  audioStarted: false,
  scaleMode: 'pentatonic',
  attractMode: true, // Start in attract mode
  webcamError: null,

  setHandsDetected: (detected) => set({ handsDetected: detected }),
  setAudioStarted: (started) => set({ audioStarted: started }),
  toggleScale: () =>
    set((state) => ({
      scaleMode: state.scaleMode === 'pentatonic' ? 'mixolydian' : 'pentatonic',
    })),
  setAttractMode: (active) => set({ attractMode: active }),
  setWebcamError: (error) => set({ webcamError: error }),
}));
