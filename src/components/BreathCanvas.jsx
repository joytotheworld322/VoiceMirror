import React, { useRef, useEffect } from 'react';

const STATE_CONFIG = {
  silent: { bg: '#0e0e0e', color: [0x2a, 0x2a, 0x2a], baseRadius: 18 },
  good: { bg: '#0a1a0f', color: [0x4a, 0xdf, 0x84], baseRadius: 38 },
  loud: { bg: '#1a1400', color: [0xf5, 0xc5, 0x18], baseRadius: 52 },
  danger: { bg: '#1a0505', color: [0xff, 0x3b, 0x3b], baseRadius: 66 },
};

const LERP_K = 0.15;

export default function BreathCanvas({ status, overrideConfig = null }) {
  const canvasRef = useRef(null);
  const animRef = useRef({
    radius: 18,
    r: 0x2a, g: 0x2a, b: 0x2a,
    time: 0,
    lastTs: null,
  });
  const statusRef = useRef(status);
  const overrideRef = useRef(overrideConfig);
  
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { overrideRef.current = overrideConfig; }, [overrideConfig]);

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

      const target = overrideRef.current || STATE_CONFIG[statusRef.current] || STATE_CONFIG.silent;
      const lerpFactor = 1 - Math.pow(LERP_K, dt || 0.016);

      anim.radius += (target.baseRadius - anim.radius) * lerpFactor;
      anim.r += (target.color[0] - anim.r) * lerpFactor;
      anim.g += (target.color[1] - anim.g) * lerpFactor;
      anim.b += (target.color[2] - anim.b) * lerpFactor;

      const pulseAmp = anim.radius * 0.15;
      const r = Math.max(1, anim.radius + pulseAmp * Math.sin(anim.time * Math.PI * 0.5));

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const cr = Math.round(anim.r);
      const cg = Math.round(anim.g);
      const cb = Math.round(anim.b);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const rings = [
        { scale: 2.8, opacity: 0.15 },
        { scale: 1.8, opacity: 0.25 },
        { scale: 1.0, opacity: 1.0 },
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
  }, []);

  return <canvas ref={canvasRef} className="breath-canvas" />;
}
