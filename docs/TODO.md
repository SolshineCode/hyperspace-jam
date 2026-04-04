# Hyperspace Jam — Implementation TODO

> Read `docs/RESEARCH.md` and `CLAUDE.md` BEFORE starting any step.

## Step 1: Scaffold & Dependencies ✅
- [x] Initialize Vite+React+TS project
- [x] Install dependencies (@mediapipe/tasks-vision, tone, three, R3F, zustand, vite-plugin-glsl)
- [x] Create folder structure (/components, /audio, /vision, /shaders, /store)
- [x] Set up CLAUDE.md with architecture rules
- [x] Create GitHub repo
- [x] Research and document all library API patterns (RESEARCH.md)
- [x] Write working Poincaré GLSL skeleton
- [x] Implement ScaleQuantizer with full scale note generation

## Step 2: Global State & Vision Engine
- [ ] **Zustand Store** (`src/store/useAppStore.ts`) — ALREADY IMPLEMENTED ✅
  - [x] handsDetected, audioStarted, scaleMode, attractMode, webcamError
  - [x] All action methods

- [ ] **HandTracker** (`src/vision/HandTracker.ts`)
  - [ ] `async init(videoElement)`: FilesetResolver + HandLandmarker.createFromOptions
  - [ ] `start()`: rAF loop calling detectForVideo(), writing to this.hands
  - [ ] `stop()`: cancel rAF
  - [ ] `async dispose()`: handLandmarker.close()
  - [ ] Triangle area computation using cross product (helper already written)
  - [ ] Subscriber notification in detection loop

- [ ] **Auto-Recovery Logic** (inside HandTracker)
  - [ ] Catch webcam stream errors (track `ended` event on MediaStreamTrack)
  - [ ] On error: stop detection loop, wait 5s, call getUserMedia again
  - [ ] Increment retryCount. After 5 failures, call setWebcamError on zustand store
  - [ ] On successful reconnect, reset retryCount to 0

- [ ] **React Integration** (`src/components/HandTrackerProvider.tsx`)
  - [ ] Create <video> element (hidden) for webcam feed
  - [ ] Instantiate HandTracker in useEffect, init + start
  - [ ] Bridge discrete events to zustand (hands detected yes/no)
  - [ ] Store HandTracker instance in useRef for Visualizer to access
  - [ ] Expose via React context so Visualizer and AudioEngine can read hands
  - [ ] Cleanup: stop + dispose on unmount

## Step 3: Audio Architecture
- [ ] **AudioEngine** (`src/audio/AudioEngine.ts`)
  - [ ] `async start()`: Tone.start() + build master bus chain
  - [ ] Master Bus: Compressor → Limiter(-2dB) → getDestination()
  - [ ] Meter: Tone.Meter({ normalRange: true }) connected to limiter output
  - [ ] `update(hands)`: Called per frame — map hand data to instrument params
  - [ ] `panic()`: Stop transport, triggerRelease all, dispose all, rebuild
  - [ ] `getAmplitude()`: return meter.getValue() as number
  - [ ] `dispose()`: Full cleanup of all Tone nodes

- [ ] **Voice 1: Pluck Synth**
  - [ ] Tone.PluckSynth → toDestination()
  - [ ] Dampening (filter cutoff) mapped to hand 0's triangle area
  - [ ] Pitch from hand 0's index finger Y, quantized through ScaleQuantizer
  - [ ] Trigger on hand presence, release on absence

- [ ] **Voice 2: 909 Drum Kit**
  - [ ] Kick: MembraneSynth (pitchDecay:0.05, octaves:10)
  - [ ] Snare: MembraneSynth + NoiseSynth layered
  - [ ] Hi-hat: MetalSynth (harmonicity:5.1)
  - [ ] Distortion amount mapped to hand 1's triangle area
  - [ ] Trigger pattern based on hand gestures / position zones

- [ ] **Voice 3: Sub-Bass**
  - [ ] Tone.Synth({ oscillator: { type: "sine" } })
  - [ ] LFO rate mapped to triangle area
  - [ ] Low pitch range (C1-C2)

- [ ] **Panic Button**
  - [ ] Global keydown listener for Spacebar
  - [ ] Calls AudioEngine.panic()
  - [ ] Visual feedback via zustand state (brief flash)
  - [ ] Remove listener on cleanup

- [ ] **Scale Toggle Integration**
  - [ ] Read scaleMode from zustand in update()
  - [ ] Pass to ScaleQuantizer.quantize()

## Step 4: Hyperbolic Visuals
- [ ] **Visualizer Canvas** (`src/components/Visualizer.tsx`)
  - [ ] R3F Canvas: orthographic, zoom:1, antialias:false
  - [ ] Compose: HyperbolicBackground + NeonTriangles + EffectComposer

- [ ] **HyperbolicBackground** (`src/components/HyperbolicBackground.tsx`)
  - [ ] drei shaderMaterial with PoincareMaterial
  - [ ] Import fragment shader from ../shaders/Poincare.glsl
  - [ ] Vertex shader: passthrough (gl_Position = vec4(position.xy, 0, 1))
  - [ ] Fullscreen plane: <planeGeometry args={[2,2]} />, renderOrder={-1}
  - [ ] depthWrite=false, depthTest=false, toneMapped=false
  - [ ] useFrame: update u_time, u_amplitude, u_resolution
  - [ ] TypeScript: ThreeElement<typeof PoincareMaterial> module augmentation

- [ ] **NeonTriangle** (`src/components/NeonTriangle.tsx`)
  - [ ] Props: 3 Vector3 points + color
  - [ ] CatmullRomCurve3 path (closed=true)
  - [ ] TubeGeometry: 64 segments, 0.015 radius, 8 radial segments
  - [ ] meshBasicMaterial: color values > 1.0, toneMapped=false
  - [ ] Lerp positions between frames for smoothness

- [ ] **NeonTriangles container** (`src/components/NeonTriangles.tsx`)
  - [ ] Read HandTracker.hands ref in useFrame
  - [ ] Render 0-4 NeonTriangle components
  - [ ] Color mapping: hand 0=cyan, 1=magenta, 2=yellow, 3=lime
  - [ ] Convert landmark coordinates (0-1) to world space

- [ ] **Postprocessing**
  - [ ] EffectComposer: disableNormalPass, multisampling=0
  - [ ] Bloom: luminanceThreshold=1, intensity=1.5, mipmapBlur
  - [ ] ToneMapping: ACES_FILMIC mode — **MUST BE LAST EFFECT**

- [ ] **Audio-Reactive Bridge**
  - [ ] useRef<number> for amplitude value
  - [ ] Read Tone.Meter in useFrame, update ref
  - [ ] Pass ref to HyperbolicBackground for shader uniform

## Step 5: Kiosk UI & Deployment
- [ ] **UI Overlay** (`src/components/UIOverlay.tsx`)
  - [ ] Full-screen overlay: position:fixed, pointer-events:none (except buttons)
  - [ ] "Click to Start Audio" button (Tone.start requires user gesture)
  - [ ] Scale mode toggle: "Pentatonic" / "Mixolydian" button
  - [ ] Webcam status indicator (green/red dot + error message)
  - [ ] Audio status indicator
  - [ ] High contrast styling for projection readability

- [ ] **Attract Mode** (`src/components/AttractMode.tsx`)
  - [ ] 30-second timer starts when handsDetected goes false
  - [ ] Timer resets when handsDetected goes true
  - [ ] On timeout: set attractMode=true in zustand
  - [ ] Pulsing "STEP UP TO PLAY" text (CSS animation, large font)
  - [ ] Background shader receives gentle sine-wave amplitude in attract mode
  - [ ] Instant dismiss: attractMode=false when hands detected

- [ ] **App Composition** (`src/App.tsx`)
  - [ ] HandTrackerProvider wraps everything
  - [ ] Visualizer (full screen, behind overlay)
  - [ ] UIOverlay (on top)
  - [ ] AttractMode (conditional on zustand attractMode)

- [ ] **Final Polish**
  - [ ] Strip default Vite CSS/assets (App.css, index.css, logos)
  - [ ] Fullscreen body/html styles (margin:0, overflow:hidden, bg:black)
  - [ ] Test with 0, 1, 2, 3, 4 hands
  - [ ] Test webcam disconnect/reconnect
  - [ ] Test panic button (spacebar)
  - [ ] Test scale toggle
  - [ ] Test attract mode timing (30s)
  - [ ] Verify production build: `npm run build && npm run preview`
  - [ ] Deploy to Hugging Face Spaces
