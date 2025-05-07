import { Scene } from './components/Scene';
import { Gamepad2 } from 'lucide-react';
import { useEffect } from 'react';

// Update score display with animation
export const updateGlobalScore = (score: number) => {
  const scoreElement = document.getElementById('score-display');
  if (scoreElement) {
    // Trigger pulse animation
    scoreElement.classList.remove('score-pulse');
    void scoreElement.offsetWidth; // Force reflow
    scoreElement.classList.add('score-pulse');

    // Update score with animation
    scoreElement.textContent = `${score.toLocaleString()}`;
  }
};

function App() {
  // Add styles on mount
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes glow {
        0%, 100% { text-shadow: 0 0 20px rgba(255, 255, 255, 0.7); }
        50% { text-shadow: 0 0 30px #fff, 0 0 50px #ff0; }
      }
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
      }
      .score-container {
        display: flex;
        align-items: center;
        gap: 1rem;
        background: linear-gradient(45deg, rgba(0,0,0,0.7), rgba(0,0,0,0.3));
        padding: 0.75rem 1.5rem;
        border-radius: 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        backdrop-filter: blur(10px);
      }
      .score-label {
        font-size: 1.25rem;
        font-weight: 500;
        color: rgba(255,255,255,0.8);
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }
      #score-display {
        font-size: 2.5rem;
        font-weight: bold;
        color: #fff;
        min-width: 3ch;
        text-align: right;
        animation: glow 2s ease-in-out infinite;
      }
      .score-pulse {
        animation: pulse 0.3s ease-in-out;
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return (
    <div className="w-full h-screen bg-gray-900">
      <div className="absolute top-4 left-4 z-10  gap-6 p-6 text-white">
        <div className="flex items-center gap-3">
          <Gamepad2 className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Disco Runner</h1>
        </div>
      </div>
      <div className="score-container absolute top-2 right-2 z-10">
        <span className="score-label">Score</span>
        <div id="score-display">0</div>
      </div>
      <Scene />
    </div>
  );
}

export default App;
