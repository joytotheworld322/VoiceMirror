import { useRef, useEffect } from 'react';
import './App.css';
import { useAudioAnalyzer } from './useAudioAnalyzer';

// State → visual target config
const STATE_CONFIG = {
  silent: { bg: '#0e0e0e', color: [0x2a, 0x2a, 0x2a], baseRadius: 18 },
  good:   { bg: '#0a1a0f', color: [0x4a, 0xdf, 0x84], baseRadius: 38 },
  loud:   { bg: '#1a1400', color: [0xf5, 0xc5, 0x18], baseRadius: 52 },
  danger: { bg: '#1a0505', color: [0xff, 0x3b, 0x3b], baseRadius: 66 },
};

// Exponential lerp factor: how much of the gap to close per second
// At k=0.15: half-life ≈ 0.37s (feels natural for a breath transition)
const LERP_K = 0.15;

function BreathCanvas({ status }) {
  const canvasRef = useRef(null);
  // All animation state lives in a ref to avoid triggering re-renders
  const animRef = useRef({
    radius: 18,
    r: 0x2a, g: 0x2a, b: 0x2a,
    time: 0,
    lastTs: null,
  });
  // Keep a ref to the latest status so the RAF closure always sees current value
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let rafId;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function draw(timestamp) {
      const anim = animRef.current;
      const dt = anim.lastTs !== null ? Math.min((timestamp - anim.lastTs) / 1000, 0.1) : 0;
      anim.lastTs = timestamp;
      anim.time += dt;

      const target = STATE_CONFIG[statusRef.current];
      // dt-compensated exponential lerp: each second closes (1 - LERP_K) of the gap
      const lerpFactor = 1 - Math.pow(LERP_K, dt || 0.016);

      anim.radius += (target.baseRadius - anim.radius) * lerpFactor;
      anim.r += (target.color[0] - anim.r) * lerpFactor;
      anim.g += (target.color[1] - anim.g) * lerpFactor;
      anim.b += (target.color[2] - anim.b) * lerpFactor;

      // Subtle breathing pulse: 0.25 Hz (4-second cycle)
      const pulseAmp = anim.radius * 0.15;
      const r = Math.max(1, anim.radius + pulseAmp * Math.sin(anim.time * Math.PI * 0.5));

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const cr = Math.round(anim.r);
      const cg = Math.round(anim.g);
      const cb = Math.round(anim.b);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw outer → inner so the solid core sits on top of the halos
      const rings = [
        { scale: 2.8, opacity: 0.15 },
        { scale: 1.8, opacity: 0.25 },
        { scale: 1.0, opacity: 1.0  },
      ];
      rings.forEach(({ scale, opacity }) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
        ctx.globalAlpha = opacity;
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []); // RAF loop starts once, reads statusRef reactively

  return <canvas ref={canvasRef} className="breath-canvas" />;
}

export default function App() {
  const { status, currentDb, ambientDb, permissionState } = useAudioAnalyzer();
  const bg = STATE_CONFIG[status]?.bg ?? '#0e0e0e';
  const relativeDb = Math.max(0, Math.round(currentDb) - ambientDb);

  if (permissionState === 'denied') {
    return (
      <div className="denied-screen">
        <p className="denied-title">마이크 권한이 필요해요</p>
        <p className="denied-desc">
          브라우저 설정에서 이 사이트의 마이크 접근을 허용한 뒤 새로고침해 주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="app" style={{ backgroundColor: bg }}>
      <BreathCanvas status={status} />
      <span className="app-name">VOICEMIRROR</span>
      <div className="bottom-info">
        <span>ambient {ambientDb} dB</span>
        <span>+{relativeDb} dB</span>
      </div>
    </div>
  );
}
