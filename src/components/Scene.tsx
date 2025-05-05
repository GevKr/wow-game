import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { GameObjects } from './GameObjects';

export function Scene() {
  return (
    <Canvas camera={{ position: [0, 5, 10], fov: 75 }} style={{ background: '#111' }}>
      <Suspense fallback={null}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <GameObjects />
        <OrbitControls />
      </Suspense>
    </Canvas>
  );
}
