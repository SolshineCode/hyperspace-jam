---
title: Hyperspace Jam
emoji: 🎹
colorFrom: purple
colorTo: blue
sdk: static
pinned: false
---

# Hyperspace Jam

An interactive audio-visual festival installation powered by hand tracking.

Step in front of the webcam, hold up your hands, and play music with your fingers. The system tracks your hand landmarks in real-time, maps finger positions to synthesizers, and renders hyperbolic geometry that pulses to the beat.

## Features

- **Hand Tracking**: MediaPipe Hands tracks up to 4 hands simultaneously (2 players)
- **3 Synth Voices**: Pluck synth, 909 drum kit, and sub-bass — all controlled by hand geometry
- **Scale Quantizer**: Toggle between C Minor Pentatonic and Mixolydian modes
- **Hyperbolic Visuals**: Poincaré disk tessellation that warps with the audio
- **Neon Triangles**: Glowing geometry connecting your fingertips with heavy bloom
- **Kiosk Ready**: Auto attract mode, panic button, speaker protection

## Controls

| Input | Action |
|-------|--------|
| Hands in frame | Play instruments |
| Triangle size (thumb-index-pinky) | Filter cutoff / Distortion / LFO rate |
| Finger Y position | Pitch (quantized to scale) |
| Spacebar | Panic button — kill all audio |
| Scale toggle button | Switch Pentatonic ↔ Mixolydian |

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Tech Stack

- Vite + React + TypeScript
- MediaPipe Hands + Camera Utils
- Tone.js
- Three.js + React Three Fiber + Drei + Postprocessing
- Zustand
- Custom GLSL shaders

## License

MIT
