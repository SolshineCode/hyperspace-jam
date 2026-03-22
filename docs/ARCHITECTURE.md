# Hyperspace Jam — Architecture

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser Window                           │
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────────┐  │
│  │  HandTracker  │   │  AudioEngine │   │   Visualizer.tsx   │  │
│  │  (tasks-     │   │  (Tone.js    │   │  (React Three F.  │  │
│  │   vision)    │   │   v15)       │   │   v9)             │  │
│  │              │   │              │   │                    │  │
│  │  webcam ──►  │   │  Pluck Synth │   │  Neon Triangles   │  │
│  │  landmarks   │──►│  909 Drums   │   │  (TubeGeometry    │  │
│  │  @ 30-60fps  │   │  Sub-Bass    │   │   + Bloom)        │  │
│  │              │   │  ──────────  │   │                    │  │
│  │  useRef /    │──►│  Limiter     │──►│  Poincaré Shader  │  │
│  │  event bus   │   │  Compressor  │   │  (u_amplitude)    │  │
│  └──────────────┘   └──────────────┘   └────────────────────┘  │
│         │                    │                    │              │
│         ▼                    ▼                    ▼              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Zustand Store v5                       │    │
│  │  handsDetected: boolean                                  │    │
│  │  audioStarted: boolean                                   │    │
│  │  scaleMode: 'pentatonic' | 'mixolydian'                 │    │
│  │  attractMode: boolean                                    │    │
│  │  webcamError: string | null                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                      UI Overlay                          │    │
│  │  Scale toggle | Panic indicator | Attract mode prompt    │    │
│  │  Audio start button | Webcam status                      │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow (Real-Time Path)

```
Webcam Frame
  │
  ▼
HandLandmarker.detectForVideo(video, timestamp)  ← synchronous return
  │
  ├──► HandTracker.hands (mutable array)  ──► Visualizer reads in useFrame
  │                                             (no React re-render)
  │
  ├──► AudioEngine.update(hands)
  │     ├── compute triangle area (landmarks 4, 8, 20)
  │     ├── quantize Y position to scale note
  │     ├── trigger/modulate synths
  │     └── Tone.Meter.getValue() → amplitude
  │
  └──► Zustand (discrete events only)
        ├── handsDetected = true/false (debounced)
        └── reset attractMode timer
```

### Why No React State for Landmarks
MediaPipe delivers landmark data at 30-60fps. Each `useState` call triggers a React reconciliation cycle. With 21 landmarks x 3 coordinates x up to 4 hands, that's 252 state updates per frame — React will choke.

Instead:
- `HandTracker` writes to a mutable `hands` array (no re-render)
- `Visualizer` reads `handTracker.hands` in its `useFrame` callback (runs every animation frame)
- `AudioEngine.update()` is called imperatively from the same loop

## Audio Architecture

```
Instrument Layer          Master Bus           Output
─────────────────         ──────────           ──────
Pluck Synth ──────┐
                  ├──► Compressor ──► Limiter(-2dB) ──► getDestination()
909 Drums ────────┤         ▲
                  │         │
Sub-Bass ─────────┘    Tone.Meter
                       ({ normalRange: true })
                       → getValue() → shader u_amplitude
```

### Scale Quantizer
All pitch values pass through the quantizer before reaching synths:
- Input: continuous Y-position (0.0 - 1.0 from hand landmark)
- Output: nearest MIDI note in the active scale
- Scales:
  - **C Minor Pentatonic**: C3-C5 — intervals [0, 3, 5, 7, 10]
  - **Mixolydian**: C3-C5 — intervals [0, 2, 4, 5, 7, 9, 10]

### Parameter Mapping
| Hand Gesture | Audio Parameter |
|-------------|----------------|
| Triangle Area (landmarks 4,8,20) | Filter cutoff (Pluck), Distortion (909), LFO rate (Sub-Bass) |
| Index finger Y position | Pitch (quantized to scale) |
| Hand presence/absence | Note on/off |

## Visual Pipeline

### R3F v9 Canvas Setup
```
Canvas (orthographic, antialias=false)
├── HyperbolicBackground (renderOrder=-1, depthWrite/Test=false)
│   └── PlaneGeometry(2,2) + PoincareMaterial (custom shaderMaterial)
├── NeonTriangles
│   ├── NeonTriangle (hand 0, cyan [0,2,2])
│   ├── NeonTriangle (hand 1, magenta [2,0,2])
│   ├── NeonTriangle (hand 2, yellow [2,2,0])
│   └── NeonTriangle (hand 3, lime [0,2,0])
└── EffectComposer (disableNormalPass, multisampling=0)
    ├── Bloom (threshold=1, intensity=1.5, mipmapBlur)
    └── ToneMapping (ACES_FILMIC) ← MUST BE LAST
```

### Bloom Strategy
- Background shader outputs colors ≤ 1.0 → **no bloom** (preserves tessellation clarity)
- Neon triangle materials output colors > 1.0 → **bloom catches them** (glow effect)
- `toneMapped={false}` on both materials (manual color control)
- `luminanceThreshold={1}` = only fragments brighter than 1.0 get bloomed

### Poincaré Disk Shader
- Custom `shaderMaterial` applied to a fullscreen quad
- {7,3} heptagonal tiling — fold/reflect algorithm (20 iterations)
- Uniforms:
  - `u_time: float` — elapsed time for animation
  - `u_amplitude: float` — master audio level (0.0-1.0)
  - `u_resolution: vec2` — viewport size
- Audio reactivity: amplitude modulates rotation speed, scale "breathing", and color saturation

## Kiosk Behavior

```
State Machine:
  PLAYING ──(no hands for 30s)──► ATTRACT
  ATTRACT ──(hands detected)────► PLAYING
```

### Attract Mode
- Shader continues with slow rotation (u_amplitude = gentle sine wave ~0.1)
- "STEP UP TO PLAY" text overlay, pulsing opacity
- Webcam continues processing — instant response when hands appear
