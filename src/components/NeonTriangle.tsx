import * as THREE from 'three'
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'

interface NeonTriangleProps {
  points: [THREE.Vector3, THREE.Vector3, THREE.Vector3]
  color: [number, number, number]
}

export default function NeonTriangle({ points, color }: NeonTriangleProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const frameCount = useRef(0)

  const curve = useMemo(
    () => new THREE.CatmullRomCurve3([...points, points[0]], true),
    // Only create once — we update points in useFrame
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  useFrame(() => {
    // Update curve control points every frame (cheap)
    curve.points[0].copy(points[0])
    curve.points[1].copy(points[1])
    curve.points[2].copy(points[2])
    curve.points[3].copy(points[0])

    // Only rebuild geometry every 3 frames to avoid GC pressure
    frameCount.current++
    if (frameCount.current % 3 !== 0) return

    curve.updateArcLengths()

    if (meshRef.current) {
      const oldGeo = meshRef.current.geometry
      meshRef.current.geometry = new THREE.TubeGeometry(curve, 32, 0.02, 6, true)
      oldGeo.dispose()
    }
  })

  return (
    <mesh ref={meshRef}>
      <tubeGeometry args={[curve, 32, 0.02, 6, true]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
}
