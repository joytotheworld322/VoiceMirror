import React from 'react';
import BreathCanvas from '../components/BreathCanvas';

export default function SplashScreen() {
  return (
    <div className="app loading-splash" style={{ 
      background: '#0e0e0e',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {/* BreathCanvas removed */}
      <p style={{
        marginTop: 24,
        fontFamily: 'Space Mono, monospace',
        fontSize: '9px',
        letterSpacing: '0.15em',
        color: 'rgba(255,255,255,0.2)',
        position: 'absolute',
        bottom: 40
      }}>
        VOICEMIRROR
      </p>
    </div>
  );
}
