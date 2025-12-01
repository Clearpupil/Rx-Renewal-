import React from 'react';

interface VisualizerProps {
  isActive: boolean;
  color: string;
}

export const Visualizer: React.FC<VisualizerProps> = ({ isActive, color }) => {
  // Increased number of bars for a "medical readout" look
  const bars = 8;
  
  return (
    <div className="flex items-center justify-center space-x-1.5 h-16">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={`w-3 rounded-full ${color} transition-all duration-300 ease-in-out shadow-sm`}
          style={{
            height: isActive ? `${20 + Math.random() * 80}%` : '4px',
            opacity: isActive ? 0.8 : 0.3,
            animation: isActive ? `bounce ${0.4 + Math.random() * 0.2}s infinite alternate ${i * 0.05}s` : 'none'
          }}
        />
      ))}
      <style>{`
        @keyframes bounce {
          0% { height: 20%; transform: scaleY(1); }
          100% { height: 100%; transform: scaleY(1.1); }
        }
      `}</style>
    </div>
  );
};