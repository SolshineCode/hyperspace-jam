# Hyperspace Jam — Claude Code Instructions

## Project Overview
"Hyperspace Jam" is a Vite+React+TypeScript interactive festival installation.
Users step in front of a webcam, hold up their hands, and the system:
1. Tracks hand landmarks via MediaPipe Hands
2. Maps finger positions to musical parameters via Tone.js
3. Renders neon triangle visuals and a hyperbolic tessellation background via React Three Fiber

Supports up to **4 simultaneous hands** (2 people).

## Tech Stack
| Layer | Library |
|-------|---------|
| Framework | Vite + React 19 + TypeScript |
| Hand Tracking | @mediapipe/hands + @mediapipe/camera_utils |
| Audio | Tone.js (Pluck, 909 Drums, Sub-Bass, Limiter, Compressor) |
| 3D/Visuals | Three.js + @react-three/fiber + @react-three/drei + @react-three/postprocessing |
| State | Zustand (global app state only — NOT for 60fps data) |
| Shaders | Custom GLSL (Poincaré hyperbolic tessellation) |

## Architecture Rules

### CRITICAL: No React State for Real-Time Data
- **NEVER** use `useState` or zustand for hand landmark coordinates.
- Hand data flows at 30-60fps. React re-renders will destroy performance.
- Use `useRef` or a vanilla JS event emitter to pass coordinate data to the R3F canvas.
- Zustand is ONLY for discrete app state: "are hands detected?", "is audio started?", "which scale mode?".

### Folder Structure
```
src/
├── components/    # React components (Visualizer, UI overlays, AttractMode)
├── audio/         # Tone.js AudioEngine, scale quantizer, instrument configs
├── vision/        # MediaPipe HandTracker, auto-reconnect logic
├── shaders/       # GLSL shader files (Poincaré tessellation)
├── store/         # Zustand store definitions
├── App.tsx        # Root — composes vision, audio, and visuals
└── main.tsx       # Entry point
```

### Audio Safety
- Master bus MUST have a Limiter (-2dB) and Compressor to protect speakers.
- Spacebar = panic button: kills all Tone.js transport, disposes synths, rebuilds fresh.
- Always gate instrument creation behind `Tone.start()` (requires user gesture).

### MediaPipe Auto-Recovery
- If webcam disconnects or errors, retry connection every 5 seconds.
- Log reconnect attempts to console. After 5 failures, show UI error.

### Scale Quantizer
- Default: C Minor Pentatonic (C, Eb, F, G, Bb)
- Toggle: Mixolydian mode (C, D, E, F, G, A, Bb)
- All pitch mapping goes through the quantizer — no raw frequency values.

### Visual Pipeline
- Orthographic camera for the R3F scene.
- Neon tubes connect landmarks 4 (thumb tip), 8 (index tip), 20 (pinky tip) per hand.
- Heavy Bloom postprocessing on the triangles.
- Background: custom shaderMaterial with Poincaré disk tessellation.
- Audio reactivity: `Tone.Meter` feeds `u_amplitude` uniform into the shader.

### Kiosk / Attract Mode
- 30 seconds with no hands detected → enter attract mode.
- Attract mode: slow shader rotation + pulsing "STEP UP TO PLAY" text.
- Any hand detection → exit attract mode immediately.

## Deployment Target
- Hugging Face Spaces with `sdk: static`
- Build output goes to `dist/`
- README.md YAML header must match HF requirements

## Dev Commands
```bash
npm run dev      # Start dev server
npm run build    # TypeScript check + Vite build
npm run preview  # Preview production build
```

## Testing Philosophy
- Manual testing is primary (this is a real-time AV installation)
- Verify: dev server starts clean, no TS errors, no console errors
- Test with webcam: hand detection works, audio responds, visuals render
- Test edge cases: no webcam, webcam disconnect, multiple hands, spacebar panic
