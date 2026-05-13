'use client';

import { useEffect, useState } from 'react';
import { exitPresent } from '@/hooks/usePresentMode';

export default function PresentControls() {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { /* ignore */ });
    } else {
      document.documentElement.requestFullscreen().catch(() => { /* ignore */ });
    }
  };

  return (
    <div className="present-controls" role="toolbar" aria-label="Presentation controls">
      <button onClick={toggleFullscreen} title="Toggle fullscreen (F)">
        {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      </button>
      <button onClick={exitPresent} title="Exit presentation (Esc)">
        Exit
      </button>
    </div>
  );
}
