import React, { useState, useEffect } from 'react';

export const CallTimer: React.FC<{ startTime: number | null }> = ({ startTime }) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (startTime === null) {
      setSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="font-mono text-lg font-bold text-slate-900">
      {formatTime(seconds)}
    </div>
  );
};
