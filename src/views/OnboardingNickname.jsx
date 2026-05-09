import React, { useState, useEffect } from 'react';
import { updateUserProfile } from '../lib/userService';

export default function OnboardingNickname({ userId, googleName, onComplete }) {
  const [nickname, setNickname] = useState(googleName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!nickname.trim() || isSaving) return;

    setIsSaving(true);
    setError(null);
    try {
      await updateUserProfile(userId, { nickname: nickname.trim() });
      onComplete();
    } catch (err) {
      console.error('Update profile error:', err);
      // 구체적인 에러 내용 표시
      const errorMsg = err.message || '알 수 없는 오류';
      setError(`데이터베이스 오류: ${errorMsg}\n(Supabase SQL Editor에서 테이블 생성 스크립트를 실행했는지 확인해 주세요.)`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="app onboarding-container" style={{ 
      background: '#0e0e0e', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '100%',
      padding: 'calc(env(safe-area-inset-top) + 60px) 0 calc(env(safe-area-inset-bottom) + 20px)'
    }}>

      {/* 상단: 인디케이터 */}
      <div className="onboarding-step-indicator">
        <span className="dot active"></span>
        <span className="dot"></span>
        <span className="dot"></span>
      </div>

      {/* 중앙: 입력 영역 (절대 위치 클래스 제거) */}
      <div style={{ 
        textAlign: 'center', 
        width: '100%', 
        padding: '0 40px',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px', fontFamily: 'Space Mono' }}>
          어떻게 불러드릴까요?
        </p>
        <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginBottom: '40px', fontFamily: 'Space Mono' }}>
          앱 안에서 사용할 이름이에요.
        </p>

        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <input 
            type="text" 
            placeholder="이름이나 닉네임을 입력해주세요"
            maxLength={10}
            autoFocus
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            style={{
              width: '100%',
              border: 'none',
              borderBottom: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent',
              color: 'white',
              fontFamily: 'Space Mono',
              fontSize: '18px',
              textAlign: 'center',
              paddingBottom: '12px',
              outline: 'none'
            }}
          />
          {error && (
            <div style={{ marginTop: '24px' }}>
              <p style={{ color: 'rgba(255,59,59,0.9)', fontSize: '10px', fontFamily: 'Space Mono', lineHeight: 1.6 }}>
                {error}
              </p>
            </div>
          )}
        </form>
      </div>

      {/* 하단: 다음 버튼 */}
      <button 
        onClick={handleSubmit}
        disabled={!nickname.trim() || isSaving}
        style={{
          background: 'none',
          border: 'none',
          color: 'white',
          fontFamily: 'Space Mono',
          fontSize: '14px',
          padding: '20px',
          cursor: 'pointer',
          opacity: (nickname.trim() && !isSaving) ? 1 : 0.3,
          transition: 'opacity 0.2s'
        }}
      >
        {isSaving ? '저장 중...' : '다음 →'}
      </button>

      <style>{`
        .onboarding-container { position: relative; width: 100%; height: 100%; overflow: hidden; }

        .onboarding-step-indicator { display: flex; gap: 8px; }
        .dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.2); }
        .dot.active { background: rgba(255,255,255,0.7); }
      `}</style>
    </div>
  );
}
