import React, { useEffect, useState } from 'react';
import BreathCanvas from '../components/BreathCanvas';
import { STATE_CONFIG } from '../constants';
import { getSessionCount } from '../lib/sessionService';

export default function MainView({ 
  status, 
  currentDb, 
  ambientDb, 
  userId,
  onNavigateToInsight,
  onSettings,
  sessionSeconds = 0
}) {
  const [sessionCount, setSessionCount] = useState(0);

  useEffect(() => {
    async function loadCount() {
      if (!userId) return;
      try {
        const count = await getSessionCount(userId);
        setSessionCount(count);
      } catch (e) {
        console.error('세션 카운트 로드 실패:', e);
      }
    }
    loadCount();
  }, [userId]);

  const showInsight = true;
  const bg = STATE_CONFIG[status]?.bg ?? '#0e0e0e';
  const relativeDb = Math.max(0, Math.round(currentDb) - ambientDb);

  const nickname = localStorage.getItem('vm_nickname') || '';
  
  const greeting = (() => {
    if (!nickname) return '';
    if (sessionCount === 0)      return `안녕하세요, ${nickname}.`;
    else if (sessionCount < 5)   return `${nickname}, 오늘도 왔네요.`;
    else                         return `${nickname}, 벌써 ${sessionCount + 1}번째 세션이에요.`;
  })();

  return (
    <div className="app main-view" style={{ backgroundColor: bg }}>
      <header className="main-header">
        <div className="brand-group">
          <span className="app-name-static">VOICEMIRROR</span>
          {greeting && (
            <p className="user-greeting">
              {greeting}
            </p>
          )}
        </div>
        <button 
          className="settings-btn-prominent" 
          style={{ zIndex: 9999, position: 'relative' }}
          onClick={() => {
            console.log('Settings button clicked');
            onSettings();
          }}
        >
          SETTINGS
        </button>
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
