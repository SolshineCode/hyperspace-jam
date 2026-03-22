# Hyperspace Jam — Implementation TODO

## Step 1: Scaffold & Dependencies ✅
- [x] Initialize Vite+React+TS project
- [x] Install all dependencies (@mediapipe/hands, tone, three, R3F, zustand, etc.)
- [x] Create folder structure (/components, /audio, /vision, /shaders, /store)
- [x] Set up CLAUDE.md with architecture rules
- [x] Create GitHub repo

## Step 2: Global State & Vision Engine
- [ ] **Zustand Store** (`src/store/useAppStore.ts`)
  - [ ] `handsDetected: boolean`
  - [ ] `audioStarted: boolean`
  - [ ] `scaleMode: 'pentatonic' | 'mixolydian'`
  - [ ] `attractMode: boolean`
  - [ ] `webcamError: string | null`
  - [ ] Actions: `setHandsDetected`, `setAudioStarted`, `toggleScale`, `setAttractMode`

- [ ] **HandTracker** (`src/vision/HandTracker.ts`)
  - [ ] Initialize MediaPipe Hands with `maxNumHands: 4`
  - [ ] Set up webcam via `@mediapipe/camera_utils`
  - [ ] Store landmarks in a mutable ref / event emitter (NOT React state)
  - [ ] Export a `subscribe(callback)` pattern for consumers
  - [ ] Compute triangle area from landmarks 4, 8, 20

- [ ] **Auto-Recovery Logic**
  - [ ] Detect webcam disconnect/error events
  - [ ] Implement 5-second retry interval
  - [ ] Max 5 retries before showing UI error
  - [ ] Log all reconnect attempts to console

- [ ] **React Integration** (`src/components/HandTrackerProvider.tsx`)
  - [ ] Wrap HandTracker in a component that manages lifecycle
  - [ ] Bridge discrete events (hands detected yes/no) to zustand
  - [ ] Expose landmark ref for Visualizer consumption

## Step 3: Audio Architecture
- [ ] **AudioEngine** (`src/audio/AudioEngine.ts`)
  - [ ] Master Bus: `Tone.Compressor` → `Tone.Limiter(-2)` → `Tone.getDestination()`
  - [ ] `Tone.Meter` on master bus for visual feedback
  - [ ] `start()` method (must be called from user gesture)
  - [ ] `update(landmarks)` method (called per frame)
  - [ ] `panic()` method (kill all, dispose, rebuild)
  - [ ] `dispose()` method for cleanup

- [ ] **Instruments**
  - [ ] Voice 1: `Tone.PluckSynth` — filter cutoff mapped to triangle area
  - [ ] Voice 2: 909 Drum Kit — use `Tone.MembraneSynth` + `Tone.NoiseSynth` — distortion mapped to triangle area
  - [ ] Voice 3: `Tone.Synth` (sine wave sub-bass) — LFO rate mapped to triangle area

- [ ] **Scale Quantizer** (`src/audio/ScaleQuantizer.ts`)
  - [ ] C Minor Pentatonic intervals: [0, 3, 5, 7, 10]
  - [ ] C Mixolydian intervals: [0, 2, 4, 5, 7, 9, 10]
  - [ ] `quantize(value: number, scale: Scale): number` → MIDI note
  - [ ] Map input range (0-1 from hand Y position) to note range (C3-C5)

- [ ] **Panic Button**
  - [ ] Spacebar listener (global keydown)
  - [ ] Calls `AudioEngine.panic()`
  - [ ] Visual feedback: brief red flash on UI

## Step 4: Hyperbolic Visuals
- [ ] **Visualizer** (`src/components/Visualizer.tsx`)
  - [ ] R3F Canvas with Orthographic camera
  - [ ] `useFrame` loop: read landmark ref, update triangle geometry
  - [ ] Render up to 4 neon triangles (landmarks 4, 8, 20 per hand)
  - [ ] Emissive material with high intensity
  - [ ] Bloom postprocessing (EffectComposer + Bloom)

- [ ] **Triangle Geometry** (`src/components/NeonTriangle.tsx`)
  - [ ] TubeGeometry or custom Line geometry
  - [ ] Color per hand (hand 0=cyan, 1=magenta, 2=yellow, 3=lime)
  - [ ] Smooth interpolation (lerp) to avoid jitter

- [ ] **Poincaré Shader** (`src/shaders/Poincare.glsl`)
  - [ ] Vertex shader: fullscreen quad pass-through
  - [ ] Fragment shader: hyperbolic tessellation in Poincaré disk model
  - [ ] Uniforms: `u_time`, `u_amplitude`, `u_resolution`
  - [ ] Audio-reactive warping: amplitude modulates tessellation scale/rotation
  - [ ] High contrast colors suitable for projection

- [ ] **Background Plane** (`src/components/HyperbolicBackground.tsx`)
  - [ ] Fullscreen plane with custom shaderMaterial
  - [ ] `useFrame`: update `u_time` and `u_amplitude` uniforms
  - [ ] Read amplitude from Tone.Meter

## Step 5: Kiosk UI & Deployment
- [ ] **UI Overlay** (`src/components/UIOverlay.tsx`)
  - [ ] Full-screen, pointer-events-none overlay (except interactive elements)
  - [ ] Scale mode toggle button (Pentatonic / Mixolydian)
  - [ ] Webcam status indicator
  - [ ] Audio status indicator
  - [ ] "Click to Start Audio" prompt (required for Tone.js)

- [ ] **Attract Mode** (`src/components/AttractMode.tsx`)
  - [ ] 30-second inactivity timer (no hands detected)
  - [ ] Pulsing "STEP UP TO PLAY" text (CSS animation)
  - [ ] Shader continues with gentle sine-wave amplitude
  - [ ] Instant dismiss on hand detection

- [ ] **README.md for Hugging Face**
  - [ ] YAML frontmatter: `title`, `emoji`, `colorFrom`, `colorTo`, `sdk: static`, `pinned: false`
  - [ ] Project description and usage instructions
  - [ ] Build instructions

- [ ] **Final Polish**
  - [ ] Test with 0, 1, 2, 3, 4 hands
  - [ ] Test webcam disconnect/reconnect
  - [ ] Test panic button
  - [ ] Test scale toggle
  - [ ] Test attract mode timing
  - [ ] Verify production build works
  - [ ] Deploy to Hugging Face Spaces
