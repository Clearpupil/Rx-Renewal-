import React from 'react';

interface VisualizerProps {
  volume: number;
  isActive: boolean;
  isSpeaking: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ volume, isActive, isSpeaking }) => {
  // Simple visualizer with 3 bars that react to volume
  const bars = [1, 2, 3];
  
  // Scale volume (0-1) to height multiplier
  const heightMultiplier = Math.min(volume * 10, 1.5); 
  
  return (
    <div className="flex items-center justify-center space-x-2 h-16 w-full">
      {isActive ? (
        bars.map((i) => (
          <div
            key={i}
            className={`w-3 bg-teal-500 rounded-full transition-all duration-75 ease-out ${isSpeaking ? 'bg-indigo-500' : 'bg-teal-500'}`}
            style={{
              height: `${20 + (Math.random() * 30 * heightMultiplier) + 10}px`,
              opacity: 0.8
            }}
          />
        ))
      ) : (
        <div className="text-gray-400 text-sm">Microphone Idle</div>
      )}
    </div>
  );
};

export default Visualizer;