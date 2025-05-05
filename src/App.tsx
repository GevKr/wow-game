import { Scene } from './components/Scene';
import { Gamepad2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

function App() {
  return (
    <div className="w-full h-screen bg-gray-900">
      <div className="absolute top-0 left-0 z-10 flex items-center gap-2 p-4 text-white">
        <Gamepad2 className="w-6 h-6" />
        <h1 className="text-2xl font-bold">Three.js Game</h1>
        <Button variant="destructive" onClick={() => alert('clicked')} className="w-20">
          Click me
        </Button>
      </div>
      <Scene />
    </div>
  );
}

export default App;
