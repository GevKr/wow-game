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
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
      }
      .score-container {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        background: rgba(0,0,0,0.5);
        padding: 0.75rem 1.5rem;
        border-radius: 1rem;
        border: 2px solid rgba(100,210,255,0.3);
        box-shadow: 0 0 20px rgba(0,150,255,0.3);
        backdrop-filter: blur(10px);
      }
      .score-label {
        font-size: 1.75rem;
        font-weight: 700;
        color: rgba(255,255,255,0.9);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        text-shadow: 0 0 10px rgba(100,210,255,0.7);
      }
      #score-display {
        font-size: 3.5rem;
        font-weight: bold;
        color: #fff;
        min-width: 3ch;
        text-align: right;
        animation: glow 2s ease-in-out infinite;
        text-shadow: 0 0 15px rgba(100,210,255,0.9);
      }
      .score-pulse {
        animation: pulse 0.3s ease-in-out;
      }
      .game-title {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1.5rem;
        background: rgba(0,0,0,0.5);
        border-radius: 1rem;
        box-shadow: 0 0 15px rgba(0,0,0,0.4);
        backdrop-filter: blur(5px);
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return (
    <div className="w-full h-screen bg-gray-900">
      <div className="absolute top-4 left-4 z-10 text-white">
        <div className="game-title">
          <Gamepad2 className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Disco Runner</h1>
        </div>
      </div>
      <div className="score-container absolute top-4 right-4 z-10">
        <span className="score-label">SCORE</span>
        <div id="score-display">0</div>
      </div>
      <Scene />
    </div>
  );
}

export default App;
