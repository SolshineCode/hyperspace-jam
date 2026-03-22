import * as THREE from 'three'
import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import NeonTriangle from './NeonTriangle'
import type { HandTracker } from '../vision/HandTracker'
import type { AudioEngine } from '../audio/AudioEngine'

const COLORS: [number, number, number][] = [
  [0, 2, 2],   // cyan
  [2, 0, 2],   // magenta
  [2, 2, 0],   // yellow
  [0, 2, 0],   // lime
]

const LERP_FACTOR = 0.3

interface NeonTrianglesProps {
  amplitudeRef: React.RefObject<number>
  trackerRef: React.RefObject<HandTracker | null>
  audioRef: React.RefObject<AudioEngine | null>
}

interface TriangleData {
  visible: boolean
  points: [THREE.Vector3, THREE.Vector3, THREE.Vector3]
}

export default function NeonTriangles({ amplitudeRef, trackerRef, audioRef }: NeonTrianglesProps) {
  const { viewport } = useThree()

  const triangles = useRef<TriangleData[]>([
    { visible: false, points: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
    { visible: false, points: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
    { visible: false, points: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
    { visible: false, points: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
  ])

  useFrame(() => {
    const tracker = trackerRef.current
    const audio = audioRef.current

    // Update amplitude from audio engine
    if (audio && 'getAmplitude' in audio && typeof (audio as { getAmplitude: () => number }).getAmplitude === 'function') {
      amplitudeRef.current = (audio as { getAmplitude: () => number }).getAmplitude()
    }

    const hands = tracker?.hands ?? []
    const vw = viewport.width
    const vh = viewport.height

    for (let i = 0; i < 4; i++) {
      const tri = triangles.current[i]
      if (i < hands.length) {
        const lm = hands[i].landmarks
        // Landmarks 4 (thumb), 8 (index), 20 (pinky)
        const targets = [
          { x: (lm[4].x - 0.5) * vw, y: -(lm[4].y - 0.5) * vh },
          { x: (lm[8].x - 0.5) * vw, y: -(lm[8].y - 0.5) * vh },
          { x: (lm[20].x - 0.5) * vw, y: -(lm[20].y - 0.5) * vh },
        ]

        for (let j = 0; j < 3; j++) {
          tri.points[j].x += (targets[j].x - tri.points[j].x) * LERP_FACTOR
          tri.points[j].y += (targets[j].y - tri.points[j].y) * LERP_FACTOR
          tri.points[j].z = 0
        }
        tri.visible = true
      } else {
        tri.visible = false
      }
    }
  })

  return (
    <>
      {triangles.current.map((tri, i) => (
        <group key={i} visible={tri.visible}>
          <NeonTriangle points={tri.points} color={COLORS[i]} />
        </group>
      ))}
    </>
  )
}
