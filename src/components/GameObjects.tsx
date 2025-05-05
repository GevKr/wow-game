import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Mesh } from 'three';

export function GameObjects() {
  const boxRef = useRef<Mesh>(null);

  useFrame((state, delta) => {
    if (boxRef.current) {
      boxRef.current.rotation.x += delta;
      boxRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <mesh ref={boxRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#f00" />
    </mesh>
  );
}
