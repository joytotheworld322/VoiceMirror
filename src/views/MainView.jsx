import React, { useMemo } from 'react';
import BreathCanvas from '../components/BreathCanvas';
import { STATE_CONFIG } from '../constants';

export default function MainView({ 
  status, 
  currentDb, 
  ambientDb, 
  onResetStart, 
  onResetEnd, 
  onNavigateToInsight,
  sessionSeconds = 0
}) {
  const hasSessions = useMemo(() => {
    return JSON.parse(localStorage.getItem('vm_sessions') || '[]').length > 0;
  }, []);

  // Show insight if there's at least 1 saved session OR if current session reached minimum duration
  const showInsight = true;
  
  const bg = STATE_CONFIG[status]?.bg ?? '#0e0e0e';
  const relativeDb = Math.max(0, Math.round(currentDb) - ambientDb);

  return (
    <div className="app main-view" style={{ backgroundColor: bg }}>
      <header>
        <span 
          className="app-name" 
          onMouseDown={onResetStart} 
          onMouseUp={onResetEnd}
          onTouchStart={onResetStart}
          onTouchEnd={onResetEnd}
        >
          VOICEMIRROR
        </span>
      </header>
      
      <BreathCanvas status={status} />
      
      <div className="bottom-info">
        <span>{ambientDb} dB</span>
        <span>/</span>
        <span className="info-db">+{relativeDb} dB</span>
        <span className="info-status">{status.toUpperCase()}</span>
      </div>

      {showInsight && (
        <button className="insight-trigger" onClick={onNavigateToInsight}>
          insight
        </button>
      )}
    </div>
  );
}
