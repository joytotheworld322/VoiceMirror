import React, { useEffect, useState, useRef, useMemo } from 'react';
import { analyzeSession } from '../utils/analyzeSession';
import { analyzePattern } from '../utils/analyzePattern';
import { generateFeedback } from '../utils/generateFeedback';
import { getRecentSessions } from '../lib/sessionService';

function DonutChart({ stateRatio }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 72 * dpr;
    canvas.height = 72 * dpr;
    ctx.scale(dpr, dpr);

    const cx = 36;
    const cy = 36;
    const radius = 27;
    const lineWidth = 9;
    const gap = 0.04;

    const data = [
      { key: 'good', color: '#4adf84' },
      { key: 'loud', color: '#f5c518' },
      { key: 'danger', color: '#ff3b3b' },
      { key: 'silent', color: '#1e2e22' },
    ];

    let currentAngle = -Math.PI / 2;

    ctx.clearRect(0, 0, 72, 72);
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'butt';

    data.forEach(item => {
      const ratio = stateRatio[item.key] || 0;
      if (ratio <= 0) return;

      const angle = ratio * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, currentAngle + gap/2, currentAngle + angle - gap/2);
      ctx.strokeStyle = item.color;
      ctx.stroke();
      currentAngle += angle;
    });
  }, [stateRatio]);

  return <canvas ref={canvasRef} style={{ width: 72, height: 72 }} />;
}

function SmallBreathPulse() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let rafId;
    let time = 0;

    const draw = () => {
      time += 0.05;
      const radius = 12 + Math.sin(time) * 2;
      ctx.clearRect(0, 0, 60, 60);
      ctx.beginPath();
      ctx.arc(30, 30, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#1e2e22'; // Silent color pulse
      ctx.fill();
      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, []);
  return <canvas ref={canvasRef} width={60} height={60} />;
}

export default function InsightView({ userId, currentSession, onBack, onSettings }) {
  const [dbSessions, setDbSessions] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);

  useEffect(() => {
    async function load() {
      if (!userId) return;
      setLoadingData(true);
      try {
        const raw = await getRecentSessions(userId, 30);
        // Map snake_case to camelCase for analyzePattern compatibility
        const mapped = raw.map(s => ({
          id: s.id,
          startedAt: s.started_at,
          duration: s.duration,
          ambientFloor: s.ambient_anchor,
          samples: s.samples,
          sessionComfortLevel: s.session_comfort_level,
          vocalLoadSeconds: s.vocal_load_seconds,
          lombardRatio: s.lombard_ratio,
          vocalVariability: s.variability,
          stateRatio: s.state_ratio,
          halfStats: {
            firstHalfAvg: s.first_half_avg,
            secondHalfAvg: s.second_half_avg,
          }
        }));
        setDbSessions(mapped);
      } catch (e) {
        console.error('세션 로드 실패:', e);
      }
      setLoadingData(false);
    }
    load();
  }, [userId]);

  const sessions = useMemo(() => {
    if (currentSession && currentSession.samples.length >= 10) {
      const liveSession = {
        ...currentSession,
        duration: currentSession.samples.length,
        ambientFloor: currentSession.ambientCount > 0 ? currentSession.ambientTotal / currentSession.ambientCount : 40
      };
      // For the trend, we only show DB sessions. The "Today's Voice" uses the most recent.
      return [...dbSessions, liveSession];
    }
    return dbSessions;
  }, [dbSessions, currentSession]);

  const latestSession = sessions[sessions.length - 1];
  const sessionAnalysis = useMemo(() => {
    if (!latestSession) return null;
    // If it's a live session, we analyze it. If it's from DB, we already have most stats but analyzeSession is safer for full UI consistency.
    return analyzeSession(latestSession);
  }, [latestSession]);

  const patternAnalysis = useMemo(() => {
    return analyzePattern(sessions);
  }, [sessions]);

  const fetchFeedback = () => {
    if (sessionAnalysis && !isLoadingFeedback) {
      setIsLoadingFeedback(true);
      generateFeedback(sessionAnalysis, patternAnalysis, latestSession).then(res => {
        setFeedback(res);
        setIsLoadingFeedback(false);
      }).catch(() => {
        setIsLoadingFeedback(false);
        setFeedback("피드백을 가져오는 데 실패했습니다.");
      });
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, [sessionAnalysis, patternAnalysis]);

  const formatDuration = (s) => {
    const m = Math.floor(s / 60);
    const rs = Math.round(s % 60);
    return m > 0 ? `${m}분 ${rs}초` : `${rs}초`;
  };

  if (loadingData) {
    return (
      <div className="insight-view empty">
        <header className="insight-header">
          <span className="app-name-small">VOICEMIRROR v2</span>
          <button className="back-button-text" onClick={onBack}>BACK</button>
        </header>
        <div className="loading-container">
          <SmallBreathPulse />
        </div>
      </div>
    );
  }

  if (!sessionAnalysis) {
    return (
      <div className="insight-view empty">
        <header className="insight-header">
          <span className="app-name-small">VOICEMIRROR v2</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="settings-trigger" onClick={onSettings}>···</button>
            <button className="back-button-text" onClick={onBack}>BACK</button>
          </div>
        </header>
        <div className="empty-state">
          <p>아직 분석할 데이터가 충분하지 않아요.</p>
          <p className="sub">최소 20초 이상의 모니터링과<br/>5초 이상의 발화 데이터가 쌓이길 기다려주세요.</p>
        </div>
      </div>
    );
  }

  // --- Calculations for UI ---
  const totalVoicedSeconds = sessionAnalysis.duration * (1 - sessionAnalysis.stateRatio.silent);
  const vocalLoadPercent = totalVoicedSeconds > 0 
    ? (sessionAnalysis.vocalLoadSeconds / totalVoicedSeconds) * 100 
    : 0;

  let vocalLoadText = "성대에 무리가 없었어요.";
  let vocalLoadColor = "rgba(74,223,132,0.6)";
  if (vocalLoadPercent > 10) {
    vocalLoadText = "성대를 꽤 많이 썼어요. 오늘 목 관리가 필요할 것 같아요.";
    vocalLoadColor = "rgba(255,59,59,0.6)";
  } else if (vocalLoadPercent > 0) {
    vocalLoadText = "성대에 약간 힘이 들어갔어요.";
    vocalLoadColor = "rgba(245,197,24,0.55)";
  }

  const anchor = latestSession.ambientFloor || sessionAnalysis.ambientFloor;
  let ambientEnv = "보통 환경";
  let ambientDesc = "일반적인 실내 수준이었어요.";
  if (anchor < 45) {
    ambientEnv = "조용한 환경";
    ambientDesc = "배경 소음이 거의 없었어요.";
  } else if (anchor > 60) {
    ambientEnv = "시끄러운 환경";
    ambientDesc = "주변 소음이 꽤 있었어요.";
  }

  let lombardMsg = "환경 소음에도 목소리를 잘 유지했어요.";
  let lombardColor = "#4adf84";
  if (sessionAnalysis.lombardRatio >= 15) {
    lombardMsg = "소음 때문에 목소리가 많이 올라간 세션이에요. 가능하다면 더 조용한 환경에서 대화해보세요.";
    lombardColor = "#ff3b3b";
  } else if (sessionAnalysis.lombardRatio >= 5) {
    lombardMsg = "소음 대비 목소리가 자연스럽게 올라갔어요.";
    lombardColor = "#f5c518";
  }

  // Recent Sessions Bar Logic
  const recentSessionsData = sessions.slice(-7).map(s => {
    const analysis = analyzeSession(s);
    const date = new Date(s.startedAt || s.started_at);
    const isToday = date.toDateString() === new Date().toDateString();
    const isYesterday = date.toDateString() === new Date(Date.now() - 86400000).toDateString();
    let dateLabel = `${date.getMonth() + 1}/${date.getDate()}`;
    if (isToday) dateLabel = "오늘";
    if (isYesterday) dateLabel = "어제";
    
    let barColor = "#4adf84";
    const dangerRatio = (analysis.stateRatio?.danger || 0) * 100;
    if (dangerRatio > 15) barColor = "#ff3b3b";
    else if (dangerRatio > 5) barColor = "#f5c518";

    return { dangerRatio, dateLabel, barColor };
  });

  return (
    <div className="insight-view">
      <header className="insight-header">
        <span className="app-name-small">VOICEMIRROR v2</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="settings-trigger" onClick={onSettings}>···</button>
          <button className="back-button-text" onClick={onBack}>BACK</button>
        </div>
      </header>

      <div className="insight-scroll-content">
        <section className="insight-card today-voice" style={{ backgroundColor: '#0a1a0f' }}>
          <span className="eyebrow green">TODAY'S VOICE</span>
          <div className="card-content-row">
            <DonutChart stateRatio={sessionAnalysis.stateRatio} />
            <div className="legend">
              <div className="legend-item"><span className="dot good"></span><span>good</span></div>
              <div className="legend-item"><span className="dot loud"></span><span>loud</span></div>
              <div className="legend-item"><span className="dot danger"></span><span>danger</span></div>
              <div className="legend-item"><span className="dot silent"></span><span>silent</span></div>
            </div>
          </div>
          
          <div className="voice-stats-summary" style={{ marginTop: 12 }}>
            <p style={{ fontFamily: 'Space Mono', fontSize: 13, fontWeight: 'bold', color: 'rgba(255,255,255,0.6)' }}>
              총 {formatDuration(totalVoicedSeconds)} 발화
            </p>
            <p className="card-note" style={{ color: vocalLoadColor, marginTop: 8 }}>
              {vocalLoadText}
            </p>
          </div>
        </section>

        <section className="insight-card dark">
          <span className="eyebrow">ENVIRONMENT</span>
          <div className="env-header" style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 'bold', color: '#fff' }}>{ambientEnv}</p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{ambientDesc}</p>
          </div>
          <p className="card-note" style={{ color: lombardColor, fontSize: 11, marginBottom: 12 }}>
            {lombardMsg}
          </p>
          {(sessionAnalysis.lombardRatio > 2 || patternAnalysis.sessionCount > 3) && (
            <div className="bar-chart-container" style={{ height: 36 }}>
              {patternAnalysis.lombardTrend.map((item, i) => (
                <div 
                  key={i} 
                  className="bar blue" 
                  style={{ height: `${Math.min(100, (item.lombard / 30) * 100)}%` }}
                />
              ))}
            </div>
          )}
        </section>

        <section className="insight-card dark">
          <span className="eyebrow">RECENT SESSIONS</span>
          {patternAnalysis.insufficient ? (
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>세션이 쌓이면 패턴을 보여드릴게요.</p>
          ) : (
            <>
              <div className="bar-chart-with-labels" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 60, marginBottom: 8 }}>
                {recentSessionsData.map((d, i) => (
                  <div key={i} className="bar-group" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                    <div 
                      className="bar" 
                      style={{ 
                        width: 8,
                        height: `${Math.max(10, d.dangerRatio)}px`, 
                        backgroundColor: d.barColor,
                        borderRadius: 2
                      }}
                    />
                    <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{d.dateLabel}</span>
                  </div>
                ))}
              </div>
              <p className="card-note" style={{ 
                color: patternAnalysis.trendMessage === 'increasing' ? '#f5c518' : '#4adf84', 
                fontSize: 11,
                marginTop: 12 
              }}>
                {patternAnalysis.trendMessage === 'increasing' ? "최근 세션에서 성대 부하가 높아지고 있어요." : 
                 patternAnalysis.trendMessage === 'decreasing' ? "최근 세션에서 성대 부하가 줄고 있어요." : 
                 "비슷한 패턴이 유지되고 있어요."}
              </p>
            </>
          )}
        </section>

        <section className="insight-card feedback-card">
          <span className="eyebrow">VOICE MIRROR</span>
          <div className="divider"></div>
          {isLoadingFeedback ? (
            <div className="loading-container">
              <SmallBreathPulse />
            </div>
          ) : (
            <>
              <p className="feedback-text">
                {feedback}
              </p>
              <button 
                onClick={fetchFeedback}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'rgba(255,255,255,0.3)', 
                  fontFamily: 'Space Mono', 
                  fontSize: 10, 
                  marginTop: 12,
                  padding: 0,
                  cursor: 'pointer'
                }}
              >
                다시 불러오기
              </button>
            </>
          )}
        </section>

        <div className="insight-footer" style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)', marginTop: 24, textAlign: 'center' }}>
          설정 변경 → 우측 상단 메뉴 이용
        </div>
      </div>
    </div>
  );
}
