# Hyperspace Jam — Claude Code Instructions

## Project Overview
"Hyperspace Jam" is a Vite+React+TypeScript interactive festival installation.
Users step in front of a webcam, hold up their hands, and the system:
1. Tracks hand landmarks via MediaPipe Tasks Vision (HandLandmarker)
2. Maps finger positions to musical parameters via Tone.js
3. Renders neon triangle visuals and a hyperbolic tessellation background via React Three Fiber

Supports up to **4 simultaneous hands** (2 people).

## Tech Stack
| Layer | Library |
|-------|---------|
| Framework | Vite + React 19 + TypeScript |
| Hand Tracking | @mediapipe/tasks-vision (HandLandmarker API) |
| Audio | Tone.js v15 (Pluck, 909 Drums, Sub-Bass, Limiter, Compressor) |
| 3D/Visuals | Three.js 0.183 + @react-three/fiber v9 + @react-three/drei v10 + @react-three/postprocessing v3 |
| State | Zustand v5 (global app state only — NOT for 60fps data) |
| Shaders | Custom GLSL via vite-plugin-glsl (Poincaré hyperbolic tessellation) |

## Architecture Rules

### CRITICAL: No React State for Real-Time Data
- **NEVER** use `useState` or zustand for hand landmark coordinates.
- Hand data flows at 30-60fps. React re-renders will destroy performance.
- Use `useRef` or a vanilla JS event emitter to pass coordinate data to the R3F canvas.
- Zustand is ONLY for discrete app state: "are hands detected?", "is audio started?", "which scale mode?".

### MediaPipe: Use tasks-vision, NOT legacy @mediapipe/hands
- The legacy `@mediapipe/hands` package is EOL (deprecated March 2023) and breaks Vite production builds.
- Use `@mediapipe/tasks-vision` with `HandLandmarker` + `FilesetResolver`.
- `HandLandmarker.detectForVideo()` returns results synchronously — no callback pattern.
- No need for `@mediapipe/camera_utils` — use native `navigator.mediaDevices.getUserMedia()`.
- WASM files load from CDN: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm`
- Model loads from: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`

### Tone.js v15 API Notes
- **Use `Tone.getDestination()`** not `Tone.Destination` (property is deprecated in v15).
- **Use `Tone.getTransport()`** not `Tone.Transport`.
- **Use `meter.getValue()`** not `meter.getLevel()` (deprecated in v15).
- **Use `toDestination()`** not `toMaster()` (deprecated).
- PluckSynth, MembraneSynth, NoiseSynth, MetalSynth all present in v15.
- TypeScript types are bundled — no `@types/tone` needed.
- Always call `Tone.start()` from a user gesture before playing audio.

### React Three Fiber v9 + Postprocessing v3 Rules
- **MUST add `<ToneMapping>` as the LAST effect inside `<EffectComposer>`** — v3 disables R3F's built-in tone mapping; without this, colors will look wrong.
- Use `ThreeElement<typeof Material>` for TypeScript declarations of custom materials — NOT `Node<>` or global JSX namespace.
- Set `toneMapped={false}` on any material that should glow through Bloom.
- Set `key={Material.key}` on drei `shaderMaterial` JSX for hot-reload.
- `useMemo` all uniform objects if using raw `THREE.ShaderMaterial`.
- Prefer `<tubeGeometry>` over `<Line>` for neon tubes (avoids lineWidth 1px cap).
- Use `disableNormalPass` on EffectComposer (saves a render pass).

### GLSL Imports
- vite-plugin-glsl handles `.glsl` imports as strings with `#include` support.
- Import pattern: `import fragmentShader from '../shaders/Poincare.glsl'`
- Type declaration in `src/glsl.d.ts` handles TypeScript.

### Folder Structure
```
src/
├── components/    # React components (Visualizer, UI overlays, AttractMode)
├── audio/         # Tone.js AudioEngine, scale quantizer, instrument configs
├── vision/        # HandLandmarker tracker, auto-reconnect logic
├── shaders/       # GLSL shader files (Poincaré tessellation)
├── store/         # Zustand store definitions
├── App.tsx        # Root — composes vision, audio, and visuals
└── main.tsx       # Entry point
```

### Audio Safety
- Master bus MUST have a Limiter (-2dB) and Compressor to protect speakers.
- Spacebar = panic button: kills all Tone.js transport, disposes synths, rebuilds fresh.
- Always gate instrument creation behind `Tone.start()` (requires user gesture).
- Disposal pattern: `triggerRelease()` → `dispose()` → null reference.

### MediaPipe Auto-Recovery
- If webcam disconnects or errors, retry connection every 5 seconds.
- Log reconnect attempts to console. After 5 failures, show UI error.

### Scale Quantizer
- Default: C Minor Pentatonic (C, Eb, F, G, Bb) — intervals [0, 3, 5, 7, 10]
- Toggle: Mixolydian mode (C, D, E, F, G, A, Bb) — intervals [0, 2, 4, 5, 7, 9, 10]
- All pitch mapping goes through the quantizer — no raw frequency values.
- Map range: hand Y position (0.0-1.0) → MIDI notes C3 (48) to C5 (72)

### Visual Pipeline
- Orthographic camera for the R3F scene.
- Neon tubes connect landmarks 4 (thumb tip), 8 (index tip), 20 (pinky tip) per hand.
- Heavy Bloom postprocessing: `luminanceThreshold={1}`, `mipmapBlur`, `intensity={1.5}`.
- Background: custom shaderMaterial with Poincaré disk tessellation ({7,3} heptagonal tiling).
- Audio reactivity: `Tone.Meter` feeds `u_amplitude` uniform into the shader.
- Background shader outputs colors ≤ 1.0 (no bloom); triangle materials output colors > 1.0 (bloom).

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
