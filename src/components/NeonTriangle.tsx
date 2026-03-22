import * as THREE from 'three'
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'

interface NeonTriangleProps {
  points: [THREE.Vector3, THREE.Vector3, THREE.Vector3]
  color: [number, number, number]
}

export default function NeonTriangle({ points, color }: NeonTriangleProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const geoRef = useRef<THREE.TubeGeometry>(null)

  const curve = useMemo(
    () => new THREE.CatmullRomCurve3([...points, points[0]], true),
    // Only create once — we update points in useFrame
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  useFrame(() => {
    // Update curve control points
    curve.points[0].copy(points[0])
    curve.points[1].copy(points[1])
    curve.points[2].copy(points[2])
    curve.points[3].copy(points[0])
    curve.updateArcLengths()

    // Rebuild geometry from updated curve
    if (meshRef.current && geoRef.current) {
      geoRef.current.dispose()
      const newGeo = new THREE.TubeGeometry(curve, 64, 0.015, 8, true)
      meshRef.current.geometry = newGeo
      geoRef.current = newGeo as unknown as THREE.TubeGeometry
    }
  })

  return (
    <mesh ref={meshRef}>
      <tubeGeometry ref={geoRef} args={[curve, 64, 0.015, 8, true]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
}
