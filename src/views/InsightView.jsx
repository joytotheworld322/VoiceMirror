import React, { useEffect, useState, useRef, useMemo } from 'react';
import { analyzeSession } from '../utils/analyzeSession';
import { analyzePattern, analyzeWeekly, DAY_LABELS } from '../utils/analyzePattern';
import { generateFeedback } from '../utils/generateFeedback';
import { getRecentSessions } from '../lib/sessionService';

// ─── 도넛 차트 ───────────────────────────────────────────────
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
    const cx = 36, cy = 36, radius = 27, lineWidth = 9, gap = 0.04;
    const data = [
      { key: 'danger', color: '#ff3b3b' },
      { key: 'loud',   color: '#f5c518' },
      { key: 'good',   color: '#4adf84' },
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
      ctx.arc(cx, cy, radius, currentAngle + gap / 2, currentAngle + angle - gap / 2);
      ctx.strokeStyle = item.color;
      ctx.stroke();
      currentAngle += angle;
    });
  }, [stateRatio]);
  return <canvas ref={canvasRef} style={{ width: 72, height: 72 }} />;
}

// ─── 로딩 애니메이션 ─────────────────────────────────────────
function SmallBreathPulse() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let rafId, time = 0;
    const draw = () => {
      time += 0.05;
      const radius = 12 + Math.sin(time) * 2;
      ctx.clearRect(0, 0, 60, 60);
      ctx.beginPath();
      ctx.arc(30, 30, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#1e2e22';
      ctx.fill();
      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, []);
  return <canvas ref={canvasRef} width={60} height={60} />;
}

// ─── 24시간 듀얼 라인 차트 ──────────────────────────────────
function DualLineChart({ session }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !session) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 300;
    const H = 80;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const samples = session.samples || [];
    const startedAt = session.startedAt ? new Date(session.startedAt) : null;
    if (!startedAt || samples.length === 0) return;

    const startHour = startedAt.getHours() + startedAt.getMinutes() / 60;
    const durationH = samples.length / 3600; // assume 1 sample/sec
    const endHour = Math.min(24, startHour + durationH);

    const toX = (hour) => (hour / 24) * W;
    const dbMin = 30, dbMax = 90;
    const toY = (db) => H - 16 - ((Math.max(dbMin, Math.min(dbMax, db)) - dbMin) / (dbMax - dbMin)) * (H - 28);

    // 세션 구간 배경
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(toX(startHour), 0, toX(endHour) - toX(startHour), H - 16);

    // Ambient 라인
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    samples.forEach((s, i) => {
      const hour = startHour + i / 3600;
      const x = toX(hour);
      const y = toY(s.db - 10); // ambient 추정 (실제 ambientFloor 없으면 db-10 근사)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 발화 라인 (state !== 'silent')
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    let started = false;
    samples.forEach((s, i) => {
      if (!s || s.state === 'silent') { started = false; return; }
      const hour = startHour + i / 3600;
      const x = toX(hour);
      const y = toY(s.db);
      if (!started) { ctx.beginPath(); ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // x축 레이블 (0, 6, 12, 18, 24)
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = `${8 * dpr}px Space Mono, monospace`;
    ctx.scale(1 / dpr, 1 / dpr);
    [0, 6, 12, 18, 24].forEach(h => {
      ctx.fillText(String(h), toX(h) * dpr, (H - 2) * dpr);
    });
  }, [session]);

  return (
    <div style={{ position: 'relative' }}>
      {/* 범례 */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginBottom: 4 }}>
        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', fontFamily: 'Space Mono' }}>── ambient</span>
        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', fontFamily: 'Space Mono' }}>── 발화</span>
      </div>
      <canvas ref={canvasRef} style={{ width: '100%', height: 80, display: 'block' }} />
    </div>
  );
}

// ─── 주간 바 차트 ────────────────────────────────────────────
function WeeklyBarChart({ weeklyData }) {
  const todayIdx = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();

  const getColor = (ratio) => {
    if (ratio < 0.05) return '#4adf84';
    if (ratio < 0.15) return '#f5c518';
    return '#ff3b3b';
  };

  return (
    <div>
      {/* 바 */}
      <div style={{ display: 'flex', alignItems: 'flex-end', height: 48, gap: 5 }}>
        {weeklyData.map((d, i) => {
          const hasData = d !== null;
          const ratio = hasData ? d.dangerRatio : 0;
          const color = hasData ? getColor(ratio) : 'rgba(255,255,255,0.08)';
          const height = hasData ? Math.max(8, ratio * 280) : 4;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              <div style={{ width: '100%', height, backgroundColor: color, opacity: hasData ? 0.7 : 1, borderRadius: '3px 3px 0 0', transition: 'height 0.4s ease' }} />
            </div>
          );
        })}
      </div>

      {/* 요일 레이블 */}
      <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
        {DAY_LABELS.map((label, i) => {
          const hasData = weeklyData[i] !== null;
          const isToday = i === todayIdx;
          const color = isToday
            ? 'rgba(255,255,255,0.6)'
            : hasData
              ? (weeklyData[i].dangerRatio < 0.05 ? 'rgba(74,223,132,0.5)' : weeklyData[i].dangerRatio < 0.15 ? 'rgba(245,197,24,0.5)' : 'rgba(255,59,59,0.5)')
              : 'rgba(255,255,255,0.2)';
          return (
            <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color, fontFamily: 'Space Mono' }}>
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ───────────────────────────────────────────
export default function InsightView({ userId, currentSession, onBack }) {
  const [dbSessions, setDbSessions] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);

  useEffect(() => {
    async function load() {
      if (!userId) return;
      setLoadingData(true);
      console.log('--- 데이터 로딩 시작 (userId:', userId, ') ---');
      try {
        const raw = await getRecentSessions(userId, 30);
        console.log('DB에서 받은 로우 데이터:', raw?.length, '개');
        
        if (!raw || !Array.isArray(raw)) { setDbSessions([]); return; }
        const mapped = raw.map(s => ({
          id: s.id,
          startedAt: s.started_at || s.startedAt,
          duration: s.duration,
          ambientFloor: s.ambient_anchor || s.ambientFloor || 40,
          samples: s.samples || [],
          sessionComfortLevel: s.session_comfort_level || s.sessionComfortLevel,
          vocalLoadSeconds: s.vocal_load_seconds || s.vocalLoadSeconds,
          lombardRatio: s.lombard_ratio || s.lombardRatio,
          vocalVariability: s.variability || s.vocalVariability,
          stateRatio: s.state_ratio || s.stateRatio,
          halfStats: { 
            firstHalfAvg: s.first_half_avg || (s.halfStats?.firstHalfAvg), 
            secondHalfAvg: s.second_half_avg || (s.halfStats?.secondHalfAvg) 
          },
        }));
        console.log('매핑 완료된 세션 데이터:', mapped.length, '개');
        setDbSessions(mapped);
      } catch (e) {
        console.error('세션 로드 중 에러 발생:', e);
      } finally {
        setLoadingData(false);
      }
    }
    load();
  }, [userId]);

  const sessions = useMemo(() => {
    if (currentSession && currentSession.samples?.length >= 10) {
      const live = {
        ...currentSession,
        duration: currentSession.samples.length,
        ambientFloor: currentSession.ambientCount > 0 ? currentSession.ambientTotal / currentSession.ambientCount : 40,
      };
      return [...dbSessions, live];
    }
    return dbSessions;
  }, [dbSessions, currentSession]);

  const latestSession = sessions[sessions.length - 1];
  const sessionAnalysis = useMemo(() => latestSession ? analyzeSession(latestSession) : null, [latestSession]);
  const patternAnalysis = useMemo(() => analyzePattern(sessions), [sessions]);
  const weeklyAnalysis = useMemo(() => analyzeWeekly(dbSessions), [dbSessions]);

  const fetchFeedback = () => {
    if (sessionAnalysis && !isLoadingFeedback) {
      setIsLoadingFeedback(true);
      generateFeedback(sessionAnalysis, patternAnalysis, latestSession)
        .then(res => { setFeedback(res); setIsLoadingFeedback(false); })
        .catch(() => { setIsLoadingFeedback(false); setFeedback('피드백을 가져오는 데 실패했습니다.'); });
    }
  };

  useEffect(() => { fetchFeedback(); }, [sessionAnalysis]);

  const formatDuration = (s) => {
    const m = Math.floor(s / 60), rs = Math.round(s % 60);
    return m > 0 ? `${m}분 ${rs}초` : `${rs}초`;
  };

  // ── 환경 분류 (요청 스펙 기준) ──
  const getAmbientInfo = (analysis) => {
    const level = analysis.ambientLevel;
    const colorMap = {
      quiet: 'rgba(74,223,132,0.7)',
      normal: 'rgba(255,255,255,0.6)',
      somewhat_loud: 'rgba(245,197,24,0.7)',
      loud: 'rgba(255,59,59,0.6)'
    };
    const labelMap = {
      quiet: '조용한 환경',
      normal: '보통 환경',
      somewhat_loud: '다소 시끄러운 환경',
      loud: '시끄러운 환경'
    };
    const descMap = {
      quiet: '도서관이나 조용한 방 수준이었어요.',
      normal: '일반적인 실내 수준이었어요.',
      somewhat_loud: '카페나 사무실 정도의 소음이 있었어요.',
      loud: '식당이나 야외처럼 소음이 꽤 많았어요.'
    };

    return {
      label: labelMap[level] || '보통 환경',
      desc: descMap[level] || '일반적인 실내 수준이었어요.',
      color: colorMap[level] || 'rgba(255,255,255,0.6)'
    };
  };

  const getLombardMsg = (ratio) => {
    if (ratio < 5) return { text: '소음 환경에서도 목소리를 잘 유지했어요.', color: 'rgba(74,223,132,0.6)' };
    if (ratio < 15) return { text: '소음이 커질 때 목소리도 자연스럽게 올라갔어요.', color: 'rgba(255,255,255,0.4)' };
    return { text: '소음에 민감하게 반응해서 목소리가 많이 올라갔어요.', color: 'rgba(245,197,24,0.6)' };
  };

  const headerJsx = (
    <header className="insight-header" style={{ borderBottom: 'none' }}>
      <button className="back-button-text" onClick={onBack} style={{ color: 'white', fontSize: '18px' }}>←</button>
      <span className="app-name-small" style={{ letterSpacing: '0.2em' }}>VOICEMIRROR</span>
    </header>
  );

  if (loadingData) {
    return (
      <div className="insight-view empty">
        {headerJsx}
        <div className="loading-container">
          <SmallBreathPulse />
          <p style={{ marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,0.4)', fontFamily: 'Space Mono' }}>데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!sessionAnalysis) {
    return (
      <div className="insight-view empty">
        {headerJsx}
        <div className="empty-state">
          <p>아직 분석할 데이터가 충분하지 않아요.</p>
          <p className="sub">최소 20초 이상의 모니터링과<br />5초 이상의 발화 데이터가 쌓이길 기다려주세요.</p>
        </div>
      </div>
    );
  }

  const totalVoicedSeconds = sessionAnalysis.duration * (1 - sessionAnalysis.stateRatio.silent);
  const vocalLoadPercent = totalVoicedSeconds > 0
    ? (sessionAnalysis.vocalLoadSeconds / totalVoicedSeconds) * 100 : 0;

  const vocalLoadText = vocalLoadPercent > 10
    ? '성대를 꽤 많이 썼어요. 오늘 목 관리가 필요할 것 같아요.'
    : vocalLoadPercent > 0 ? '성대에 약간 힘이 들어갔어요.' : '성대에 무리가 없었어요.';
  const vocalLoadColor = vocalLoadPercent > 10
    ? 'rgba(255,59,59,0.6)' : vocalLoadPercent > 0 ? 'rgba(245,197,24,0.55)' : 'rgba(74,223,132,0.6)';

  const ambientInfo = getAmbientInfo(sessionAnalysis);
  const lombardInfo = getLombardMsg(sessionAnalysis.lombardRatio || 0);

  const { weeklyData, validDays, easiestDay, hardestDay } = weeklyAnalysis;
  const weekSummary = () => {
    if (validDays.length <= 1) {
      return (
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'Space Mono', lineHeight: 1.7 }}>
          이번 주 세션이 쌓이면<br />요일별 패턴을 보여드려요.
        </p>
      );
    }
    if (easiestDay.idx === hardestDay.idx) {
      return <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'Space Mono' }}>이번 주 기록이 하루뿐이에요.</p>;
    }
    return (
      <p style={{ fontSize: 10, fontFamily: 'Space Mono', lineHeight: 1.7 }}>
        <span style={{ color: 'rgba(74,223,132,0.6)' }}>가장 편안했던 날은 {DAY_LABELS[easiestDay.idx]}요일</span>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>,<br /></span>
        <span style={{ color: 'rgba(255,59,59,0.5)' }}>가장 힘들었던 날은 {DAY_LABELS[hardestDay.idx]}요일</span>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>이에요.</span>
      </p>
    );
  };

  return (
    <div className="insight-view">
      {headerJsx}

      <div className="insight-scroll-content">

        {/* ── 1. TODAY'S VOICE ── */}
        <section className="insight-card today-voice" style={{ backgroundColor: '#0a1a0f' }}>
          <span className="eyebrow green">TODAY'S VOICE</span>
          <div className="card-content-row">
            <DonutChart stateRatio={sessionAnalysis.stateRatio} />
            <div className="legend">
              <div className="legend-item"><span className="dot good" /><span>good</span></div>
              <div className="legend-item"><span className="dot loud" /><span>loud</span></div>
              <div className="legend-item"><span className="dot danger" /><span>too loud</span></div>
              <div className="legend-item"><span className="dot silent" /><span>silent</span></div>
            </div>
          </div>
          <div className="voice-stats-summary" style={{ marginTop: 12 }}>
            <p style={{ fontFamily: 'Space Mono', fontSize: 13, fontWeight: 'bold', color: 'rgba(255,255,255,0.6)' }}>
              총 {formatDuration(totalVoicedSeconds)} 발화
            </p>
            <p className="card-note" style={{ color: vocalLoadColor, marginTop: 8 }}>{vocalLoadText}</p>
          </div>
        </section>

        {/* ── 2. ENVIRONMENT ── */}
        <section className="insight-card dark">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <span className="eyebrow">ENVIRONMENT</span>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', fontFamily: 'Space Mono' }}>오늘 세션 평균 기준</span>
          </div>

          {/* 환경 레이블 */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 'bold', color: ambientInfo.color, marginBottom: 8 }}>
              {ambientInfo.label}
            </p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{ambientInfo.desc}</p>
          </div>

          {/* 24시간 듀얼 라인 차트 */}
          <DualLineChart session={latestSession} />

          {/* Lombard 해석 */}
          <p style={{ fontSize: 10, color: lombardInfo.color, marginTop: 8 }}>
            {lombardInfo.text}
          </p>
        </section>

        {/* ── 3. THIS WEEK ── */}
        <section className="insight-card dark" style={{ background: '#111', border: '0.5px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <span className="eyebrow">THIS WEEK</span>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', fontFamily: 'Space Mono' }}>성대 부하 비율 기준</span>
          </div>
          <div style={{ marginTop: 12 }}>
            <WeeklyBarChart weeklyData={weeklyData} />
          </div>
          <div style={{ marginTop: 14 }}>
            {weekSummary()}
          </div>
        </section>

        {/* ── 4. VOICE MIRROR (AI 피드백) ── */}
        <section className="insight-card feedback-card">
          <span className="eyebrow">VOICE MIRROR</span>
          <div className="divider" />
          {isLoadingFeedback ? (
            <div className="loading-container"><SmallBreathPulse /></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p className="feedback-text" style={{ marginBottom: 0 }}>{feedback}</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={fetchFeedback}
                  className="refresh-circle-btn"
                  title="다시 분석하기"
                  style={{ 
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.04)', 
                    border: '0.5px solid rgba(255,255,255,0.12)', 
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 4v6h-6"></path>
                    <path d="M1 20v-6h6"></path>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                  </svg>
                </button>
              </div>
            </div>
          )}
        </section>

        <div style={{ height: 40 }} />

      </div>
    </div>
  );
}
