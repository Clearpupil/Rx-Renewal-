import React, { useEffect, useState } from 'react';

interface VisualizerProps {
  volume: number;
  isActive: boolean;
  isSpeaking: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ volume, isActive, isSpeaking }) => {
  const [bars, setBars] = useState<number[]>([0.3, 0.5, 0.7, 0.5, 0.3]);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      // Scale volume (0-1) to height multiplier with better sensitivity
      const volumeScale = Math.min(Math.max(volume * 50, 0.1), 1);

      // Create smooth wave-like animation
      setBars(prevBars =>
        prevBars.map((_, index) => {
          const baseHeight = 0.2;
          const randomVariation = Math.random() * 0.3;
          const volumeImpact = volumeScale * 0.5;

          // Center bars respond more to volume
          const centerWeight = 1 - Math.abs(index - 2) * 0.2;

          return baseHeight + (randomVariation + volumeImpact) * centerWeight;
        })
      );
    }, 80); // Faster update for smoother animation

    return () => clearInterval(interval);
  }, [volume, isActive]);

  return (
    <div className="flex items-center justify-center space-x-1.5 h-16 w-full">
      {isActive ? (
        bars.map((height, i) => (
          <div
            key={i}
            className={`w-2.5 rounded-full transition-all duration-100 ease-out ${
              isSpeaking ? 'bg-indigo-500 shadow-indigo-300' : 'bg-teal-500 shadow-teal-300'
            }`}
            style={{
              height: `${Math.max(height * 48, 8)}px`,
              opacity: 0.7 + height * 0.3,
              boxShadow: isSpeaking
                ? `0 0 ${height * 8}px rgba(99, 102, 241, 0.4)`
                : `0 0 ${height * 8}px rgba(20, 184, 166, 0.4)`
            }}
          />
        ))
      ) : (
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-gray-300 animate-pulse" />
          <div className="text-gray-400 text-sm">Ready</div>
        </div>
      )}
    </div>
  );
};

export default Visualizer;