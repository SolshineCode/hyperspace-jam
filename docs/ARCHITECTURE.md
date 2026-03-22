# Hyperspace Jam — Architecture

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser Window                           │
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────────┐  │
│  │  HandTracker  │   │  AudioEngine │   │   Visualizer.tsx   │  │
│  │  (MediaPipe)  │   │  (Tone.js)   │   │  (React Three F.) │  │
│  │              │   │              │   │                    │  │
│  │  webcam ──►  │   │  Pluck Synth │   │  Neon Triangles   │  │
│  │  landmarks   │──►│  909 Drums   │   │  (Bloom post)     │  │
│  │  @ 30-60fps  │   │  Sub-Bass    │   │                    │  │
│  │              │   │  ──────────  │   │  Poincaré Shader  │  │
│  │  useRef /    │──►│  Limiter     │──►│  (u_amplitude)    │  │
│  │  event bus   │   │  Compressor  │   │                    │  │
│  └──────────────┘   └──────────────┘   └────────────────────┘  │
│         │                    │                    │              │
│         ▼                    ▼                    ▼              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Zustand Store                         │    │
│  │  handsDetected: boolean                                  │    │
│  │  audioStarted: boolean                                   │    │
│  │  scaleMode: 'pentatonic' | 'mixolydian'                 │    │
│  │  attractMode: boolean                                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                      UI Overlay                          │    │
│  │  Scale toggle | Panic indicator | Attract mode prompt    │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow (Real-Time Path)

```
Webcam Frame
  │
  ▼
MediaPipe Hands (WASM)
  │
  ├──► useRef<HandLandmarks[]>  ──► Visualizer reads ref each frame
  │                                  (no React re-render)
  │
  ├──► AudioEngine.update(landmarks)
  │     ├── compute triangle area (landmarks 4, 8, 20)
  │     ├── quantize to scale note
  │     ├── trigger/modulate synths
  │     └── Tone.Meter → amplitude value
  │
  └──► Zustand (discrete events only)
        ├── handsDetected = true/false
        └── reset attractMode timer
```

### Why No React State for Landmarks
MediaPipe delivers landmark data at 30-60fps. Each `useState` call triggers a React reconciliation cycle. With 21 landmarks × 3 coordinates × up to 4 hands, that's 252 state updates per frame — React will choke.

Instead:
- `HandTracker` writes to a `useRef` (mutable, no re-render)
- `Visualizer` reads the ref in its `useFrame` callback (runs every animation frame)
- `AudioEngine` is called imperatively from the same callback

## Audio Architecture

```
Instrument Layer          Master Bus           Output
─────────────────         ──────────           ──────
Pluck Synth ──────┐
                  ├──► Compressor ──► Limiter(-2dB) ──► Speakers
909 Drums ────────┤         ▲
                  │         │
Sub-Bass ─────────┘    Tone.Meter
                       (→ shader uniform)
```

### Scale Quantizer
All pitch values pass through a quantizer before reaching synths:
- Input: continuous Y-position (0.0 - 1.0 from hand landmark)
- Output: nearest MIDI note in the active scale
- Scales:
  - **C Minor Pentatonic**: C3-C5 [C, Eb, F, G, Bb]
  - **Mixolydian**: C3-C5 [C, D, E, F, G, A, Bb]

### Parameter Mapping
| Hand Gesture | Audio Parameter |
|-------------|----------------|
| Triangle Area (landmarks 4,8,20) | Filter cutoff (Pluck), Distortion (909), LFO rate (Sub-Bass) |
| Index finger Y position | Pitch (quantized to scale) |
| Hand presence/absence | Note on/off |

## Visual Pipeline

### Triangle Rendering
- For each detected hand: draw a neon tube (THREE.TubeGeometry or Line2) connecting landmarks 4 → 8 → 20 → 4
- Material: emissive with high intensity for Bloom to pick up
- Bloom: high intensity, low threshold from @react-three/postprocessing

### Poincaré Disk Shader
- Custom `shaderMaterial` applied to a fullscreen quad
- Uniforms:
  - `u_time: float` — elapsed time for animation
  - `u_amplitude: float` — master audio level from Tone.Meter
  - `u_resolution: vec2` — viewport size
- The tessellation warps with audio amplitude, creating a "breathing" effect

## Kiosk Behavior

```
State Machine:
  PLAYING ──(no hands for 30s)──► ATTRACT
  ATTRACT ──(hands detected)────► PLAYING
```

### Attract Mode
- Shader continues with slow rotation (u_amplitude = gentle sine wave)
- "STEP UP TO PLAY" text overlay, pulsing opacity
- Webcam continues processing — instant response when hands appear
