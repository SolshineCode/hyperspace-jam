import { shaderMaterial } from '@react-three/drei'
import { extend, useFrame, useThree, type ThreeElement } from '@react-three/fiber'
import * as THREE from 'three'
import { useRef } from 'react'
import fragmentShader from '../shaders/Poincare.glsl'

const vertexShader = /* glsl */`
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const PoincareMaterial = shaderMaterial(
  { u_time: 0, u_amplitude: 0, u_resolution: new THREE.Vector2(1, 1) },
  vertexShader,
  fragmentShader
)

extend({ PoincareMaterial })

declare module '@react-three/fiber' {
  interface ThreeElements {
    poincareMaterial: ThreeElement<typeof PoincareMaterial>
  }
}

interface HyperbolicBackgroundProps {
  amplitudeRef: React.RefObject<number>
}

export default function HyperbolicBackground({ amplitudeRef }: HyperbolicBackgroundProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const size = useThree((s) => s.size)

  useFrame(({ clock }) => {
    const mat = matRef.current
    if (!mat) return
    mat.uniforms.u_time.value = clock.elapsedTime
    mat.uniforms.u_amplitude.value = amplitudeRef.current ?? 0
    mat.uniforms.u_resolution.value.set(size.width, size.height)
  })

  return (
    <mesh renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
      <poincareMaterial
        ref={matRef}
        key={PoincareMaterial.key}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </mesh>
  )
}
