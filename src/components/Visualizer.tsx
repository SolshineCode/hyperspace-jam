import { Canvas } from '@react-three/fiber'
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useRef } from 'react'
import HyperbolicBackground from './HyperbolicBackground'
import NeonTriangles from './NeonTriangles'
import type { HandTracker } from '../vision/HandTracker'

interface AudioLike {
  getAmplitude(): number;
}

interface VisualizerProps {
  trackerRef?: React.RefObject<HandTracker | null>
  audioRef?: React.RefObject<AudioLike | null>
}

export default function Visualizer({ trackerRef, audioRef }: VisualizerProps) {
  const amplitudeRef = useRef(0)
  const nullRef = useRef(null)

  return (
    <Canvas
      orthographic
      camera={{ zoom: 1, position: [0, 0, 1], near: 0.1, far: 10 }}
      gl={{ antialias: false }}
      style={{ position: 'fixed', inset: 0 }}
    >
      <HyperbolicBackground amplitudeRef={amplitudeRef} />
      <NeonTriangles
        amplitudeRef={amplitudeRef}
        trackerRef={trackerRef ?? nullRef}
        audioRef={audioRef ?? nullRef}
      />

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom
          luminanceThreshold={1}
          luminanceSmoothing={0.9}
          intensity={1.5}
          mipmapBlur
        />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </Canvas>
  )
}
