import { PerspectiveCamera } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { Game2D } from './Game2D';

export function Scene() {
  return (
    <Canvas style={{ background: 'linear-gradient(to bottom, #000022, #220022)' }}>
      <Suspense fallback={null}>
        <PerspectiveCamera
          makeDefault
          position={[0, 0, 5]}
          fov={75}
          near={0.1}
          far={1000}
        />
        <Game2D />
      </Suspense>
    </Canvas>
  );
}
