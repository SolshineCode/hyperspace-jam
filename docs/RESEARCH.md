# Hyperspace Jam — Research & Reference Guide

Compiled research for the dev team. Read this BEFORE implementing.

---

## 1. MediaPipe: tasks-vision HandLandmarker API

### Why NOT @mediapipe/hands
- Legacy package, EOL since March 2023, no updates in 3+ years
- **Breaks Vite production builds**: Closure Compiler output causes `"Cannot read properties of undefined (reading 'Hands')"` at runtime (works in dev, fails in prod)
- Would require a custom Vite plugin workaround

### HandLandmarker Setup Pattern

```typescript
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const vision = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
);

const handLandmarker = await HandLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath:
      "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
    delegate: "GPU",
  },
  numHands: 4,
  runningMode: "VIDEO",
  minHandDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});
```

### Detection Loop (no callback — synchronous return)

```typescript
function detect() {
  if (video.readyState >= 2) {
    const result = handLandmarker.detectForVideo(video, performance.now());
    // result.landmarks: NormalizedLandmark[][] (one array per hand)
    // result.handedness: Category[][] (left/right)
    tracker.hands = result.landmarks.map((lm) => ({
      landmarks: lm.map((l) => ({ x: l.x, y: l.y, z: l.z })),
      triangleArea: computeTriangleArea(lm[4], lm[8], lm[20]),
    }));
  }
  requestAnimationFrame(detect);
}
```

### Webcam Setup (native — no camera_utils needed)

```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  video: { facingMode: "user", width: 640, height: 480 },
});
videoElement.srcObject = stream;
await videoElement.play();
```

### Cleanup

```typescript
handLandmarker.close(); // not dispose() — the tasks-vision API uses close()
```

---

## 2. Tone.js v15 API Reference

### Master Bus Chain

```typescript
import * as Tone from "tone";

const compressor = new Tone.Compressor({
  threshold: -24,
  ratio: 12,
  attack: 0.003,
  release: 0.25,
  knee: 30,
});

const limiter = new Tone.Limiter(-2); // -2dB threshold

const meter = new Tone.Meter({ normalRange: true }); // 0-1 output

// Insert into destination's signal path
Tone.getDestination().chain(compressor, limiter);

// Meter taps the output
limiter.connect(meter);

// Now ALL audio routed to destination passes through compressor → limiter
const synth = new Tone.PluckSynth().toDestination();
```

### Instrument Configurations

#### Pluck Synth (Voice 1)
```typescript
const pluck = new Tone.PluckSynth({
  attackNoise: 1,
  dampening: 4000,  // filter cutoff — MAP TO TRIANGLE AREA
  resonance: 0.7,
  release: 1,
}).toDestination();

pluck.triggerAttack("C4");
pluck.triggerRelease("+1");
```

#### 909 Drums (Voice 2 — synthesized, no samples)
```typescript
// KICK
const kick = new Tone.MembraneSynth({
  pitchDecay: 0.05,
  octaves: 10,
  oscillator: { type: "sine" },
  envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4, attackCurve: "exponential" },
}).toDestination();

// SNARE (layered)
const snareMembrane = new Tone.MembraneSynth({
  pitchDecay: 0.008,
  octaves: 4,
  envelope: { attack: 0.0006, decay: 0.25, sustain: 0, release: 0.3 },
}).toDestination();

const snareNoise = new Tone.NoiseSynth({
  noise: { type: "white" },
  envelope: { attack: 0.0005, decay: 0.15, sustain: 0, release: 0.1 },
}).toDestination();

// HI-HAT
const hihat = new Tone.MetalSynth({
  harmonicity: 5.1,
  modulationIndex: 32,
  resonance: 4000,
  octaves: 1.5,
  envelope: { attack: 0.001, decay: 0.1, release: 0.01, sustain: 0 },
}).toDestination();
hihat.volume.value = -15;
```

### Panic Button Pattern
```typescript
function panic() {
  Tone.getTransport().stop();
  Tone.getTransport().cancel();
  // Dispose all instruments
  [pluck, kick, snareMembrane, snareNoise, hihat, subBass].forEach((s) => {
    s.triggerRelease();
    s.dispose();
  });
  // Rebuild fresh instances
  rebuildInstruments();
}
```

### Reading Amplitude for Shader
```typescript
// In your animation loop:
const amplitude = meter.getValue(); // returns 0-1 with normalRange: true
// Pass to shader uniform via ref
amplitudeRef.current = amplitude as number;
```

---

## 3. React Three Fiber v9 + Postprocessing v3 Patterns

### Custom shaderMaterial (drei helper — recommended)

```tsx
import { shaderMaterial } from '@react-three/drei'
import { extend, useFrame, ThreeElement } from '@react-three/fiber'
import * as THREE from 'three'

const PoincareMaterial = shaderMaterial(
  { u_time: 0, u_amplitude: 0, u_resolution: new THREE.Vector2(1, 1) },
  vertexShader,
  fragmentShader
)

extend({ PoincareMaterial })

// TypeScript declaration (R3F v9 — module augmentation, NOT global JSX)
declare module '@react-three/fiber' {
  interface ThreeElements {
    poincareMaterial: ThreeElement<typeof PoincareMaterial>
  }
}
```

### Fullscreen Shader Background

```tsx
function HyperbolicBackground() {
  const matRef = useRef<InstanceType<typeof PoincareMaterial>>(null)

  useFrame(({ clock, size }) => {
    if (!matRef.current) return
    matRef.current.u_time = clock.elapsedTime
    matRef.current.u_resolution.set(size.width, size.height)
    // matRef.current.u_amplitude = amplitudeRef.current
  })

  return (
    <mesh renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
      <poincareMaterial
        ref={matRef}
        key={PoincareMaterial.key}  // enables hot-reload
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </mesh>
  )
}
```

### Neon Tube Triangles

```tsx
function NeonTriangle({ points, color }: {
  points: [THREE.Vector3, THREE.Vector3, THREE.Vector3],
  color: [number, number, number]
}) {
  const curve = new THREE.CatmullRomCurve3([...points, points[0]], true)

  return (
    <mesh>
      <tubeGeometry args={[curve, 64, 0.015, 8, true]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
}
```

### Postprocessing (CRITICAL: ToneMapping must be last)

```tsx
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

<EffectComposer disableNormalPass multisampling={0}>
  <Bloom luminanceThreshold={1} luminanceSmoothing={0.9} intensity={1.5} mipmapBlur />
  <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
</EffectComposer>
```

### Bloom: What Glows and What Doesn't
- Materials with `toneMapped={false}` and color values > 1.0 → **GLOW**
- Materials with color values ≤ 1.0 → **no glow**
- Background shader should output ≤ 1.0 (it has its own visual style, no bloom needed)
- Triangle materials use colors like `[2, 0, 2]` (magenta, intensity 2x) → bloom catches them

---

## 4. Poincaré Disk Shader — Math Reference

### The Algorithm: "Fold/Reflect"
For each pixel: iteratively apply Möbius translations to "fold" the point back into a fundamental domain. The number of folds determines coloring/parity.

### Key Formula: Möbius Translation
```
T(z) = (z - a) / (1 - conj(a) * z)
```
Shifts point `a` to the origin while preserving hyperbolic distances.

### {P, Q} Tiling Parameters
- `P` = polygon sides, `Q` = polygons per vertex
- Hyperbolic condition: `(P-2)(Q-2) > 4`
- Our choice: `{7, 3}` — heptagons, 3 per vertex (Escher-like aesthetic)
- Vertex distance: `d = sqrt((tan(π/2 - π/Q) - tan(π/P)) / (tan(π/2 - π/Q) + tan(π/P)))`

### Audio Reactivity Parameters
| Effect | How | Range |
|--------|-----|-------|
| Breathing scale | `uv *= 1.0 + 0.12 * amplitude` | Tiles pulse inward/outward |
| Rotation speed | `rotSpeed = 0.08 + 0.3 * amplitude` | Faster spin on beats |
| Color saturation | `sat = 0.8 + 0.15 * amplitude` | More vivid on peaks |
| Edge glow width | `edgeWidth = 0.04 + 0.02 * amplitude` | Edges thicken on hits |
| Hue shift | `hue += amplitude * 0.08` | Subtle color drift with audio |

### Reference Shadertoy Implementations
- https://www.shadertoy.com/view/3llXR4 — Hyperbolic Truchet tiles (cleanest)
- https://www.shadertoy.com/view/ssd3zX — Movable/interactive
- https://www.shadertoy.com/view/7dcXDB — Educational/introductory
- https://www.shadertoy.com/view/WlBczG — Direct Poincaré tiling

### Performance
- ~20 iterations per pixel, pure ALU (no texture fetches)
- Most pixels converge in 5-10 iterations (early exit)
- Easily 60fps at 1080p on any discrete GPU from the last 8 years
- Integrated GPUs from last 5 years also fine

---

## 5. Gotchas & Pitfalls Checklist

- [ ] `@mediapipe/hands` → use `@mediapipe/tasks-vision` instead (legacy breaks Vite prod builds)
- [ ] `Tone.Destination` → use `Tone.getDestination()` (property deprecated in v15)
- [ ] `meter.getLevel()` → use `meter.getValue()` (deprecated in v15)
- [ ] Missing `<ToneMapping>` in EffectComposer → colors will be washed out
- [ ] `useState` for landmarks → use `useRef` (60fps re-renders kill performance)
- [ ] `<Line>` for neon tubes → use `<tubeGeometry>` (lineWidth capped at 1px on many GPUs)
- [ ] Raw `ShaderMaterial` uniforms not memoized → shader recompiles on re-render
- [ ] `toneMapped` not set to `false` on glowing materials → Bloom won't work
- [ ] `handLandmarker.dispose()` → use `.close()` (tasks-vision API, not Tone.js pattern)
- [ ] GLSL imports as asset URLs → install vite-plugin-glsl for string imports
