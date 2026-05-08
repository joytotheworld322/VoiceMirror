import React from 'react';

export default function LandingView({ onLogin }) {
  return (
    <div className="landing-view">
      {/* 앱 이름 */}
      <span className="landing-app-name">VOICEMIRROR</span>

      {/* 소개 문구 */}
      <h1 className="landing-intro">
        당신은 지금 본인의 목소리를<br />
        제대로 듣고 있나요
      </h1>

      {/* Google 로그인 버튼 */}
      <button className="landing-google-btn" onClick={onLogin}>
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <span>Google로 시작하기</span>
      </button>

      {/* 하단 안내 */}
      <p className="landing-footer-note">
        목소리 데이터는 기기에서만 처리되며<br />
        서버에 저장되지 않아요.
      </p>

      <style>{`
        .landing-view {
          background: #0e0e0e;
          width: 100vw;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: 'Space Mono', monospace;
          position: relative;
          overflow: hidden;
        }

        .landing-app-name {
          font-size: 9px;
          letter-spacing: 0.18em;
          color: rgba(255, 255, 255, 0.25);
          margin-bottom: 48px;
        }

        .landing-intro {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.55);
          line-height: 1.9;
          text-align: center;
          letter-spacing: 0.02em;
          margin-bottom: 48px;
          font-weight: 400;
        }

        .landing-google-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(255, 255, 255, 0.06);
          border: 0.5px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          padding: 14px 28px;
          cursor: pointer;
          transition: background 0.2s;
          color: rgba(255, 255, 255, 0.7);
          font-family: 'Space Mono', monospace;
          font-size: 12px;
          letter-spacing: 0.05em;
        }

        .landing-google-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .landing-footer-note {
          font-size: 8px;
          color: rgba(255, 255, 255, 0.18);
          text-align: center;
          line-height: 1.8;
          letter-spacing: 0.04em;
          position: absolute;
          bottom: 32px;
        }
      `}</style>
    </div>
  );
}
