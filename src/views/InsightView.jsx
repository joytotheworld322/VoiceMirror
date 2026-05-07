import React, { useEffect, useState, useRef, useMemo } from 'react';
import { analyzeSession } from '../utils/analyzeSession';
import { analyzePattern } from '../utils/analyzePattern';
import { generateFeedback } from '../utils/generateFeedback';

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
    const ctx = canvas.getContext('2d');
    let rafId;
    let time = 0;

    const draw = (timestamp) => {
      time += 0.05;
      const radius = 12 + Math.sin(time) * 2;
      ctx.clearRect(0, 0, 60, 60);
      ctx.beginPath();
      ctx.arc(30, 30, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#2a2a2a';
      ctx.fill();
      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, []);
  return <canvas ref={canvasRef} width={60} height={60} />;
}

function HalfSessionBar({ label, ratio, color }) {
  return (
    <div className="half-session-row">
      <span className="half-label">{label}</span>
      <div className="half-bar-bg">
        <div className="half-bar-fill" style={{ width: `${ratio * 100}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default function InsightView({ currentSession, onBack }) {
  const [feedback, setFeedback] = useState(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);

  const sessions = useMemo(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('vm_sessions') || '[]');
      if (currentSession && currentSession.samples.length >= 10) {
        const liveSession = {
          ...currentSession,
          duration: currentSession.samples.length,
          ambientFloor: currentSession.ambientCount > 0 ? currentSession.ambientTotal / currentSession.ambientCount : 40
        };
        return [...saved, liveSession];
      }
      return saved;
    } catch (e) {
      return [];
    }
  }, [currentSession]);

  const latestSession = sessions[sessions.length - 1];
  const sessionAnalysis = useMemo(() => {
    try {
      return latestSession ? analyzeSession(latestSession) : null;
    } catch (e) {
      return null;
    }
  }, [latestSession]);

  const patternAnalysis = useMemo(() => {
    try {
      return analyzePattern(sessions);
    } catch (e) {
      return analyzePattern([]);
    }
  }, [sessions]);

  useEffect(() => {
    if (sessionAnalysis && !feedback && !isLoadingFeedback) {
      setIsLoadingFeedback(true);
      generateFeedback(sessionAnalysis, patternAnalysis, latestSession).then(res => {
        setFeedback(res);
        setIsLoadingFeedback(false);
      }).catch(() => {
        setIsLoadingFeedback(false);
        setFeedback("피드백을 가져오는 데 실패했습니다.");
      });
    }
  }, [sessionAnalysis, patternAnalysis]);

  const formatDuration = (s) => {
    const m = Math.floor(s / 60);
    const rs = Math.round(s % 60);
    return m > 0 ? `${m}분 ${rs}초` : `${rs}초`;
  };

  if (!sessionAnalysis) {
    return (
      <div className="insight-view empty">
        <header className="insight-header">
          <span className="app-name-small">VOICEMIRROR v2</span>
          <button className="back-button-text" onClick={onBack}>BACK</button>
        </header>
        <div className="empty-state">
          <p>아직 분석할 데이터가 충분하지 않아요.</p>
          <p className="sub">최소 20초 이상의 모니터링과<br/>5초 이상의 발화 데이터가 쌓이길 기다려주세요.</p>
        </div>
      </div>
    );
  }

  const getDominantColor = (counts) => {
    const states = ['danger', 'loud', 'good', 'silent'];
    let max = -1;
    let dominant = 'silent';
    states.forEach(s => {
      if ((counts[s] || 0) > max) {
        max = counts[s];
        dominant = s;
      }
    });
    const colors = { good: '#4adf84', loud: '#f5c518', danger: '#ff3b3b', silent: '#1e2e22' };
    return colors[dominant];
  };

  // Bar width logic: normalize based on max of the two
  const maxHalf = Math.max(0.1, sessionAnalysis.halfStats.firstHalfAvg, sessionAnalysis.halfStats.secondHalfAvg);
  const firstRatio = sessionAnalysis.halfStats.firstHalfAvg / maxHalf;
  const secondRatio = sessionAnalysis.halfStats.secondHalfAvg / maxHalf;

  return (
    <div className="insight-view">
      <header className="insight-header">
        <span className="app-name-small">VOICEMIRROR v2</span>
        <button className="back-button-text" onClick={onBack}>BACK</button>
      </header>

      <div className="insight-scroll-content">
        <div className="meta-chips">
          <span className="chip">실시간 세션 · {formatDuration(sessionAnalysis.duration)}</span>
          <span className="chip">총 {sessions.length}번째 분석</span>
        </div>

        <section className="insight-card today-voice">
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
          
          <div className="half-comparison">
            <HalfSessionBar 
              label="전반" 
              ratio={firstRatio} 
              color={getDominantColor(sessionAnalysis.halfStats.firstHalfState)}
            />
            <HalfSessionBar 
              label="후반" 
              ratio={secondRatio} 
              color={getDominantColor(sessionAnalysis.halfStats.secondHalfState)}
            />
          </div>

          <p className="card-note green">
            {sessionAnalysis.vocalLoadSeconds > 0 
              ? `성대 주의 구간이 약 ${formatDuration(sessionAnalysis.vocalLoadSeconds)} 있었어요.`
              : "오늘은 성대 부하 구간이 없었어요."}
          </p>
          <p className="card-note" style={{ fontSize: 10, marginTop: -8 }}>
            {sessionAnalysis.halfStats.halfDiff > sessionAnalysis.halfStats.firstHalfAvg * 0.1
              ? "대화가 길어질수록 목소리에 힘이 들어가는 편이에요."
              : "처음부터 끝까지 고르게 유지했어요."}
          </p>
        </section>

        <section className="insight-card dark">
          <span className="eyebrow">최근 7세션 · 성대 부하</span>
          <div className="bar-chart-container" style={{ height: 44 }}>
            {patternAnalysis.vocalLoadTrend.map((val, i) => (
              <div 
                key={i} 
                className="bar" 
                style={{ 
                  height: `${Math.min(100, (val / 60) * 100)}%`, 
                  backgroundColor: patternAnalysis.loadColors[i] 
                }}
              />
            ))}
          </div>
          <p className="card-note" style={{ color: patternAnalysis.trendMessage === 'increasing' ? '#f5c518' : '#4adf84', opacity: 0.5 }}>
            {patternAnalysis.insufficient ? "세션이 쌓이면 추세를 보여드릴게요." : 
             patternAnalysis.trendMessage === 'increasing' ? "최근 들어 조금씩 높아지고 있어요." : 
             patternAnalysis.trendMessage === 'decreasing' ? "최근 들어 안정되고 있어요." : "유지되고 있어요."}
          </p>
        </section>

        <section className="insight-card dark">
          <span className="eyebrow">소음 환경 반응</span>
          <p className="card-note" style={{ 
            marginBottom: 8, 
            fontSize: 10, 
            color: sessionAnalysis.ambientLevel === 'loud' ? '#f5c518' : sessionAnalysis.ambientLevel === 'quiet' ? '#4adf84' : 'rgba(255,255,255,0.35)'
          }}>
            {sessionAnalysis.ambientLevel === 'quiet' ? "조용한 환경이었어요." :
             sessionAnalysis.ambientLevel === 'loud' ? "꽤 시끄러운 환경이었어요." :
             "보통 수준의 환경이었어요."}
          </p>
          <div className="bar-chart-container" style={{ height: 36 }}>
            {patternAnalysis.lombardTrend.map((item, i) => (
              <div 
                key={i} 
                className="bar blue" 
                style={{ height: `${Math.min(100, (item.lombard / 30) * 100)}%` }}
              />
            ))}
          </div>
          {!patternAnalysis.insufficient && (
            <p className="card-note" style={{ opacity: 0.3 }}>주변이 시끄러울수록 목소리가 올라가는 경향이 있어요.</p>
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
            <p className="feedback-text">
              {feedback}
            </p>
          )}
        </section>

        <div className="insight-footer">
          측정이 부정확하다면 → VOICEMIRROR 3초 롱프레스로 재설정
        </div>
      </div>
    </div>
  );
}
