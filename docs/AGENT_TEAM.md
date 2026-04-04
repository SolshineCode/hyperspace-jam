# Hyperspace Jam — Agent Dev Team Design

## Dependency Graph

```
  ┌─────────────────┐     ┌─────────────────┐
  │  AGENT 1: Vision │     │  AGENT 2: Audio  │
  │  (Step 2)        │     │  (Step 3)        │
  │  HandTracker +   │     │  AudioEngine +   │
  │  Provider +      │     │  Instruments +   │
  │  Auto-Recovery   │     │  Panic Button    │
  └────────┬─────────┘     └────────┬─────────┘
           │                        │
           │  Both share types      │
           │  (already defined)     │
           │                        │
           ▼                        ▼
  ┌─────────────────────────────────────────┐
  │  AGENT 3: Visuals                       │
  │  (Step 4)                               │
  │  Visualizer + HyperbolicBackground +    │
  │  NeonTriangles + Postprocessing +       │
  │  Audio-Reactive Bridge                  │
  └────────────────────┬────────────────────┘
                       │
                       ▼
  ┌─────────────────────────────────────────┐
  │  AGENT 4: Kiosk UI + Integration        │
  │  (Step 5)                               │
  │  UIOverlay + AttractMode + App.tsx +    │
  │  CSS Reset + Final Composition          │
  └────────────────────┬────────────────────┘
                       │
                       ▼
  ┌─────────────────────────────────────────┐
  │  AGENT 5: QA & Build Verification       │
  │  (Post-build)                           │
  │  TypeScript check + Production build +  │
  │  Code review for perf/safety rules      │
  └─────────────────────────────────────────┘
```

## Parallelization Strategy

```
TIME ──────────────────────────────────────────────────►

Phase 1 (parallel):   [AGENT 1: Vision] ═══════════╗
                      [AGENT 2: Audio]  ═══════════╬══► merge to branch
                                                    ║
Phase 2 (sequential): ╔════════════════════════════╝
                      [AGENT 3: Visuals]  ══════════╗
                                                    ║
Phase 3 (sequential): ╔════════════════════════════╝
                      [AGENT 4: Kiosk UI] ══════════╗
                                                    ║
Phase 4 (sequential): ╔════════════════════════════╝
                      [AGENT 5: QA]  ═══════════════╝
```

**Agents 1 & 2 run in parallel** — they code to shared interfaces (TrackedHand, ScaleMode)
that are already defined. No file conflicts.

**Agents 3-5 run sequentially** — each depends on the previous agent's output.

---

## Agent 1: Vision Engineer

**Worktree branch:** `feat/vision-engine`
**Files owned:** `src/vision/HandTracker.ts`, `src/components/HandTrackerProvider.tsx`
**Reads (do not modify):** `src/store/useAppStore.ts`, `docs/RESEARCH.md`, `CLAUDE.md`

### Task

Implement the full MediaPipe Tasks Vision hand tracking pipeline with webcam
auto-recovery. Must use `@mediapipe/tasks-vision` HandLandmarker API (NOT the
legacy @mediapipe/hands — see RESEARCH.md for why and for the exact code patterns).

### Deliverables

1. **`src/vision/HandTracker.ts`** — Complete the existing skeleton:
   - `init(videoElement)`: FilesetResolver.forVisionTasks() + HandLandmarker.createFromOptions()
     - WASM CDN: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm`
     - Model: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`
     - numHands: 4, runningMode: "VIDEO", delegate: "GPU"
   - `start()`: rAF loop calling `handLandmarker.detectForVideo(video, performance.now())`
     - Write results to `this.hands` (mutable — NOT React state)
     - Call `this.notifySubscribers()` each frame
     - Use `computeTriangleArea()` (already implemented) for landmarks 4, 8, 20
   - `stop()`: Cancel rAF, clear retry timer (already stubbed)
   - `dispose()`: Call `handLandmarker.close()` (NOT .dispose() — different API)
   - Auto-recovery: listen for MediaStreamTrack `ended` event, retry getUserMedia
     every 5s, max 5 retries, then call zustand `setWebcamError()`

2. **`src/components/HandTrackerProvider.tsx`** — New file:
   - Create hidden `<video>` element for webcam feed
   - `useEffect`: call `navigator.mediaDevices.getUserMedia()`, set srcObject, init + start tracker
   - Store HandTracker instance in `useRef`
   - Expose via React context: `HandTrackerContext` with `tracker: HandTracker | null`
   - Bridge to zustand: when hands array goes 0↔non-zero, call `setHandsDetected()`
   - Cleanup on unmount: stop + dispose

### Constraints
- NEVER use useState for landmark data
- getUserMedia with `{ video: { facingMode: "user", width: 640, height: 480 } }`
- Must compile with `tsc -b --noEmit` — no type errors

---

## Agent 2: Audio Engineer

**Worktree branch:** `feat/audio-engine`
**Files owned:** `src/audio/AudioEngine.ts`
**Reads (do not modify):** `src/audio/ScaleQuantizer.ts`, `src/store/useAppStore.ts`,
`src/vision/HandTracker.ts` (types only), `docs/RESEARCH.md`, `CLAUDE.md`

### Task

Build the complete Tone.js v15 audio engine with 3 synth voices, master bus
safety chain, and panic button. Must use the v15 API (getDestination, getValue,
toDestination — see RESEARCH.md for exact patterns and gotchas).

### Deliverables

1. **`src/audio/AudioEngine.ts`** — Complete implementation:
   - `async start()`:
     - Call `await Tone.start()` (AudioContext resume)
     - Build master bus: `Tone.Compressor({ threshold: -24, ratio: 12 })` →
       `Tone.Limiter(-2)` → `Tone.getDestination()`
     - Create `Tone.Meter({ normalRange: true })` connected to limiter output
     - Instantiate all 3 voices, routed through the bus
   - `update(hands: TrackedHand[])`:
     - If hands[0]: map triangle area → pluck dampening, index Y → quantized pitch
     - If hands[1]: map triangle area → drum distortion, trigger drums based on position zones
     - If hands[2+]: map triangle area → sub-bass LFO rate
     - Use `ScaleQuantizer.quantize(yPosition, scaleMode)` for pitch
     - Read scaleMode from zustand store
   - `panic()`:
     - `Tone.getTransport().stop()` + `.cancel()`
     - `triggerRelease()` on all voices, then `.dispose()` each
     - Null all references
     - Rebuild all voices fresh (call a private `buildInstruments()` method)
   - `getAmplitude(): number`:
     - Return `this.meter.getValue() as number` (0-1 range)
   - `dispose()`:
     - Stop transport, triggerRelease all, dispose all nodes
     - Dispose compressor, limiter, meter

   Voice specifications:
   - **Voice 1 (Pluck):** `new Tone.PluckSynth({ attackNoise: 1, dampening: 4000, resonance: 0.7, release: 1 })`
     - `dampening` range: 200-8000, mapped from triangle area
   - **Voice 2 (909 Kit):**
     - Kick: `Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 10, envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 } })`
     - Snare: `Tone.MembraneSynth` + `Tone.NoiseSynth` (layered trigger)
     - Hi-hat: `Tone.MetalSynth({ harmonicity: 5.1, modulationIndex: 32, resonance: 4000 })` volume: -15dB
     - Route all through a `Tone.Distortion()` with amount mapped to triangle area (0-0.8)
   - **Voice 3 (Sub-Bass):** `Tone.Synth({ oscillator: { type: "sine" } })`
     - `Tone.LFO` rate mapped to triangle area (0.1-8 Hz)
     - Pitch range: C1-C2

### Constraints
- All instruments route through the compressor → limiter chain
- NEVER use deprecated API: no `Tone.Destination`, `Tone.Transport`, `getLevel()`, `toMaster()`
- Disposal pattern: triggerRelease() → dispose() → null
- Must compile with `tsc -b --noEmit`

---

## Agent 3: Visual Artist

**Worktree branch:** `feat/visuals`
**Depends on:** Agents 1 & 2 merged
**Files owned:** `src/components/Visualizer.tsx`, `src/components/HyperbolicBackground.tsx`,
`src/components/NeonTriangle.tsx`, `src/components/NeonTriangles.tsx`
**Reads (do not modify):** `src/shaders/Poincare.glsl`, `src/vision/HandTracker.ts`,
`src/audio/AudioEngine.ts`, `docs/RESEARCH.md`, `CLAUDE.md`

### Task

Build the React Three Fiber v9 visual pipeline: fullscreen Poincaré shader background,
neon tube triangles tracking hand landmarks, Bloom postprocessing, and audio-reactive
shader bridge. Must follow R3F v9 + postprocessing v3 patterns exactly (see RESEARCH.md).

### Deliverables

1. **`src/components/HyperbolicBackground.tsx`**:
   - drei `shaderMaterial()` wrapping the existing Poincare.glsl fragment shader
   - Vertex shader: `gl_Position = vec4(position.xy, 0.0, 1.0)` (fullscreen passthrough)
   - Register with `extend({ PoincareMaterial })`
   - TypeScript: `declare module '@react-three/fiber' { interface ThreeElements { poincareMaterial: ThreeElement<typeof PoincareMaterial> } }`
   - `<mesh renderOrder={-1}>` with `<planeGeometry args={[2, 2]} />`
   - Material props: `depthWrite={false}`, `depthTest={false}`, `toneMapped={false}`
   - `key={PoincareMaterial.key}` for hot-reload
   - `useFrame`: update `u_time`, `u_amplitude`, `u_resolution`
   - Accept `amplitudeRef: React.RefObject<number>` prop for audio bridge

2. **`src/components/NeonTriangle.tsx`**:
   - Props: `points: [Vector3, Vector3, Vector3]`, `color: [number, number, number]`
   - `THREE.CatmullRomCurve3([...points, points[0]], true)` — closed path
   - `<tubeGeometry args={[curve, 64, 0.015, 8, true]} />` (NOT Line — lineWidth cap)
   - `<meshBasicMaterial color={color} toneMapped={false} />` — color values > 1.0 for Bloom
   - Lerp point positions between frames for smooth motion (avoid jitter)

3. **`src/components/NeonTriangles.tsx`**:
   - Read `HandTracker.hands` from context ref in `useFrame` (NO useState)
   - Render 0-4 `NeonTriangle` components based on detected hands
   - Color map: hand 0 = `[0, 2, 2]` (cyan), 1 = `[2, 0, 2]` (magenta), 2 = `[2, 2, 0]` (yellow), 3 = `[0, 2, 0]` (lime)
   - Convert MediaPipe normalized coords (0-1) to orthographic world space
   - Extract landmarks[4], landmarks[8], landmarks[20] per hand

4. **`src/components/Visualizer.tsx`**:
   - `<Canvas orthographic camera={{ zoom: 1, position: [0, 0, 1] }} gl={{ antialias: false }}>`
   - Compose: `<HyperbolicBackground>` + `<NeonTriangles>` + `<EffectComposer>`
   - EffectComposer: `disableNormalPass`, `multisampling={0}`
   - `<Bloom luminanceThreshold={1} luminanceSmoothing={0.9} intensity={1.5} mipmapBlur />`
   - `<ToneMapping mode={ToneMappingMode.ACES_FILMIC} />` — **MUST BE LAST EFFECT**
   - Audio bridge: `useRef<number>(0)` for amplitude, read from AudioEngine.getAmplitude() in useFrame, pass ref to HyperbolicBackground

### Constraints
- NEVER cause React re-renders from per-frame data (useRef only)
- Background colors ≤ 1.0 (no bloom), triangle colors > 1.0 (bloom)
- `useMemo` any uniforms object if using raw ShaderMaterial
- Must compile with `tsc -b --noEmit`

---

## Agent 4: UI/Integration Lead

**Worktree branch:** `feat/kiosk-ui`
**Depends on:** Agent 3 merged
**Files owned:** `src/components/UIOverlay.tsx`, `src/components/AttractMode.tsx`,
`src/App.tsx`, `src/App.css`, `src/index.css`
**Reads (do not modify):** All other src files, `docs/RESEARCH.md`, `CLAUDE.md`

### Task

Build the kiosk UI layer, attract mode system, and compose everything into App.tsx.
Strip default Vite boilerplate. Style for high-contrast festival projection.

### Deliverables

1. **`src/components/UIOverlay.tsx`**:
   - Full-screen overlay: `position: fixed; inset: 0; pointer-events: none; z-index: 10`
   - **"Click to Start Audio" button** (pointer-events: auto)
     - Calls `AudioEngine.start()` on click
     - Hides after audio started (read `audioStarted` from zustand)
     - Required because Tone.start() needs a user gesture
   - **Scale toggle button** (bottom-right corner, pointer-events: auto)
     - Shows current mode: "PENTATONIC" / "MIXOLYDIAN"
     - Calls zustand `toggleScale()` on click
   - **Webcam status indicator** (top-left, small dot)
     - Green = webcam active, Red = error
     - Show error message from zustand `webcamError`
   - **Panic flash**: brief red border flash when spacebar pressed
     - Listen for keydown "Space", call AudioEngine.panic(), flash red for 200ms
   - High contrast: white text on transparent dark bg, large readable fonts
   - Font: system monospace for kiosk feel

2. **`src/components/AttractMode.tsx`**:
   - Read `handsDetected` and `attractMode` from zustand
   - 30-second inactivity timer:
     - Start timer when `handsDetected` goes false
     - Clear timer when `handsDetected` goes true
     - On timeout: call `setAttractMode(true)`
   - When `attractMode === true`:
     - Full-screen overlay with pulsing "STEP UP TO PLAY" text
     - CSS animation: `opacity` oscillates 0.3 ↔ 1.0, 2-second cycle
     - Large centered text, white, maybe slight glow
   - When hands detected: immediately `setAttractMode(false)`
   - In attract mode, the shader still runs (HyperbolicBackground receives a
     gentle sine-wave amplitude ~0.1 instead of real audio data)

3. **`src/App.tsx`** — Full composition:
   ```tsx
   <HandTrackerProvider>
     <Visualizer />
     <UIOverlay />
     <AttractMode />
   </HandTrackerProvider>
   ```
   - Wire AudioEngine as a useRef, pass to UIOverlay and Visualizer
   - Handle the attract-mode amplitude override (sine wave when attractMode=true)

4. **`src/index.css`** — Reset styles:
   ```css
   * { margin: 0; padding: 0; box-sizing: border-box; }
   html, body, #root { width: 100%; height: 100%; overflow: hidden; background: #000; }
   ```

5. **`src/App.css`** — Delete default Vite styles, replace with app-specific styles

6. **Cleanup**: Remove `src/assets/react.svg`, `src/assets/vite.svg`, `src/assets/hero.png`,
   `public/favicon.svg`, `public/icons.svg` — replace favicon with something relevant or remove

### Constraints
- Spacebar listener must be cleaned up on unmount
- Attract mode timer must be cleaned up on unmount
- AttractMode component should not re-mount the shader — it just changes a parameter
- Must compile with `tsc -b --noEmit`

---

## Agent 5: QA & Build Verifier

**Worktree branch:** none (runs on main integration branch)
**Depends on:** All agents merged
**Files owned:** none (read-only review + build commands only)

### Task

Verify the complete build compiles, runs, and follows all architecture rules.

### Checklist

1. **TypeScript**: `npx tsc -b --noEmit` — zero errors
2. **Production build**: `npm run build` — completes without errors
3. **Preview**: `npm run preview` — serves without console errors
4. **Architecture audit**:
   - [ ] No `useState` for landmark/amplitude data (grep for violations)
   - [ ] No `Tone.Destination` / `Tone.Transport` / `getLevel()` / `toMaster()` (deprecated API)
   - [ ] `<ToneMapping>` is the last child in `<EffectComposer>`
   - [ ] `toneMapped={false}` on all custom materials
   - [ ] `handLandmarker.close()` not `.dispose()`
   - [ ] Spacebar listener has cleanup
   - [ ] Attract mode timer has cleanup
   - [ ] Master bus has Limiter(-2dB)
   - [ ] Triangle colors > 1.0, background colors ≤ 1.0
5. **Bundle check**: `dist/` output is reasonable size, no unexpected large chunks
6. **Report**: List any issues found for human review before merge

---

## Execution Order

| Phase | Agents | Mode | Notes |
|-------|--------|------|-------|
| 1 | Agent 1 + Agent 2 | **Parallel worktrees** | No file conflicts — different directories |
| 2 | Merge Phase 1 | Sequential | Merge both branches, resolve any type issues |
| 3 | Agent 3 | Worktree | Depends on HandTracker context + AudioEngine amplitude |
| 4 | Agent 4 | Worktree | Depends on all components existing |
| 5 | Agent 5 | Main branch | Read-only audit + build verification |

## Merge Strategy

Each agent works in an isolated git worktree. After each phase:
1. Agent's worktree branch is merged to a `develop` integration branch
2. `tsc -b --noEmit` is run to verify no type conflicts
3. Next phase begins

Final PR from `develop` → `master` after Agent 5 passes.
