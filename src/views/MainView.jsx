import React, { useEffect, useState } from 'react';
import BreathCanvas from '../components/BreathCanvas';
import { STATE_CONFIG } from '../constants';
import { getSessionCount } from '../lib/sessionService';

export default function MainView({ 
  status, 
  currentDb, 
  ambientDb, 
  user,
  onNavigateToInsight,
  onSettings
}) {
  const [sessionCount, setSessionCount] = useState(0);

  useEffect(() => {
    async function loadCount() {
      if (!user?.id) return;
      try {
        const count = await getSessionCount(user.id);
        setSessionCount(count);
      } catch (e) {
        console.error('세션 카운트 로드 실패:', e);
      }
    }
    loadCount();
  }, [user?.id]);

  const bg = STATE_CONFIG[status]?.bg ?? '#0e0e0e';
  const relativeDb = Math.max(0, Math.round(currentDb) - ambientDb);
  const nickname = user?.nickname || '';
  
  // 시간대별 동적 인사말
  const getDynamicGreeting = () => {
    const hour = new Date().getHours();
    if (!nickname) return '반가워요.';
    
    if (hour >= 5 && hour < 11) return `좋은 아침이에요, ${nickname}.`;
    if (hour >= 11 && hour < 17) return `활기찬 오후네요, ${nickname}.`;
    if (hour >= 17 && hour < 21) return `편안한 저녁 보내세요, ${nickname}.`;
    return `오늘 하루 고생 많았어요, ${nickname}.`;
  };

  return (
    <div className="app main-view" style={{ backgroundColor: bg, transition: 'background-color 0.8s ease' }}>
      
      {/* 상단 인사말 */}
      <header className="main-header" style={{ 
        flexDirection: 'column', 
        alignItems: 'center', 
        paddingTop: 'calc(env(safe-area-inset-top) + 60px)' 
      }}>
        <h1 className="user-greeting" style={{ fontSize: '18px', fontWeight: '500', color: '#ffffff', letterSpacing: '-0.02em' }}>
          {getDynamicGreeting()}
        </h1>
      </header>
      
      <BreathCanvas status={status} />
      
      {/* 하단 인터렉션 영역 */}
      <footer className="main-footer" style={{ 
        position: 'absolute', 
        bottom: 0,
        left: 0, 
        right: 0, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingLeft: '30px',
        paddingRight: '30px',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 50px)', // 세이프 에어리어 적용
        pointerEvents: 'none'
      }}>
        
        {/* 좌측 설정 버튼 */}
        <button 
          className="circle-btn" 
          onClick={onSettings}
          style={{ ...circleBtnStyle, pointerEvents: 'auto' }}
        >
          <SettingsIcon />
        </button>

        {/* 중앙 상태 정보 */}
        <div className="bottom-info" style={{ 
          position: 'static', 
          margin: 0, 
          border: 'none', 
          background: 'none', 
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline', color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 600 }}>
            <span>{ambientDb}dB</span>
            <span>/</span>
            <span style={{ color: 'white' }}>+{relativeDb}dB</span>
          </div>
          <div style={{ 
            fontSize: '10px', 
            fontWeight: 700,
            letterSpacing: '0.05em', 
            marginTop: '2px', 
            textAlign: 'center',
            color: status === 'danger' ? '#ff3b3b' : 'rgba(255,255,255,0.6)'
          }}>
            {status === 'danger' ? 'TOO LOUD' : status.toUpperCase()}
          </div>
        </div>

        {/* 우측 인사이트 버튼 */}
        <button 
          className="circle-btn" 
          onClick={onNavigateToInsight}
          style={{ ...circleBtnStyle, pointerEvents: 'auto' }}
        >
          <InsightIcon />
        </button>
      </footer>
    </div>
  );
}

// ── 스타일 및 아이콘 ──────────────────────────────────────────

const circleBtnStyle = {
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  backgroundColor: 'rgba(255,255,255,0.06)',
  border: '0.5px solid rgba(255,255,255,0.15)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  cursor: 'pointer',
  padding: 0
};

const SettingsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
);

const InsightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6"></path>
    <path d="M10 22h4"></path>
    <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"></path>
  </svg>
);
