import React, { useState } from 'react';
import { updateUserProfile } from '../lib/userService';
import { deleteAllSessions } from '../lib/sessionService';
import { signOut } from '../lib/authService';
import { supabase } from '../lib/supabase';

export default function SettingsView({ user, profile, onBack, onRecalibrate }) {
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState(profile?.nickname || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const handleNicknameSubmit = async (e) => {
    e.preventDefault();
    if (!nicknameInput.trim() || nicknameInput === profile.nickname) {
      setIsEditingNickname(false);
      return;
    }
    setIsSaving(true);
    try {
      await updateUserProfile(user.id, { nickname: nicknameInput.trim() });
      setSaveMessage('저장됐어요.');
      if (onProfileUpdate) onProfileUpdate();
      setTimeout(() => {
        setSaveMessage('');
        setIsEditingNickname(false);
      }, 1500);
    } catch (e) {
      console.error('닉네임 변경 실패:', e);
      alert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm("탈퇴하면 모든 세션 기록이\n영구적으로 삭제돼요.\n정말 탈퇴할까요?");
    if (confirmed) {
      try {
        const { error } = await supabase.rpc('delete_user');
        if (error) throw error;
        await signOut();
        window.location.reload();
      } catch (e) {
        console.error('탈퇴 실패:', e);
        alert('탈퇴 처리 중 오류가 발생했습니다.');
      }
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '기록 없음';
    const d = new Date(dateStr);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  };

  return (
    <div className="insight-view settings-view" style={{ background: '#0e0e0e', fontFamily: 'Space Mono' }}>
      <header className="insight-header" style={{ borderBottom: 'none' }}>
        <button className="back-button-text" onClick={onBack} style={{ color: 'white', fontSize: '18px' }}>←</button>
        <span className="app-name-small" style={{ letterSpacing: '0.2em' }}>VOICEMIRROR</span>
      </header>

      <div className="settings-scroll-content" style={{ padding: '0 24px' }}>
        {/* 계정 섹션 */}
        <section className="settings-group" style={{ marginTop: 40 }}>
          <p className="settings-label">계정</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 20 }}>
            <svg width="16" height="16" viewBox="0 0 18 18">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71a5.41 5.41 0 0 1-.282-1.71c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.443 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{user?.email}</span>
          </div>

          <div className="nickname-row">
            {isEditingNickname ? (
              <form onSubmit={handleNicknameSubmit} style={{ display: 'flex', gap: 12 }}>
                <input 
                  autoFocus 
                  value={nicknameInput} 
                  onChange={e => setNicknameInput(e.target.value)}
                  className="nickname-edit-input"
                />
                <button type="submit" className="text-btn">저장</button>
                <button type="button" onClick={() => setIsEditingNickname(false)} className="text-btn dim">취소</button>
              </form>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{profile?.nickname}</span>
                <button onClick={() => setIsEditingNickname(true)} className="text-btn-small">[변경]</button>
              </div>
            )}
            {saveMessage && <p style={{ fontSize: '9px', color: '#4adf84', marginTop: 4 }}>{saveMessage}</p>}
          </div>
          <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', marginTop: 12 }}>사용 시작: {formatDate(profile?.created_at)}</p>
        </section>

        {/* 목소리 기준 섹션 */}
        <section className="settings-group" style={{ marginTop: 48 }}>
          <p className="settings-label">목소리 기준</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <div>
              <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>마지막 측정: {formatDate(profile?.updated_at)}</p>
            </div>
            <button onClick={onRecalibrate} className="recalibrate-trigger">재측정하기 →</button>
          </div>
        </section>

        {/* 계정 관리 섹션 */}
        <section className="settings-group" style={{ marginTop: 60, borderTop: '0.5px solid rgba(255,255,255,0.06)', paddingTop: 24 }}>
          <p className="settings-label">계정 관리</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 16 }}>
            <button onClick={() => signOut()} className="settings-action-row">로그아웃</button>
            <button onClick={handleDeleteAccount} className="settings-action-row danger">탈퇴하기</button>
          </div>
        </section>
      </div>

      <style>{`
        .settings-view { height: 100vh; overflow-y: auto; }
        .settings-label { font-size: 9px; color: rgba(255,255,255,0.3); letter-spacing: 0.1em; }
        .text-btn { background: none; border: none; color: white; font-family: 'Space Mono'; font-size: 11px; cursor: pointer; }
        .text-btn.dim { color: rgba(255,255,255,0.3); }
        .text-btn-small { background: none; border: none; color: rgba(255,255,255,0.3); font-family: 'Space Mono'; font-size: 10px; cursor: pointer; }
        .nickname-edit-input { background: none; border: none; border-bottom: 1px solid rgba(255,255,255,0.3); color: white; font-family: 'Space Mono'; font-size: 13px; outline: none; width: 120px; }
        .recalibrate-trigger { background: none; border: none; color: white; font-family: 'Space Mono'; font-size: 11px; cursor: pointer; }
        .settings-action-row { background: none; border: none; color: rgba(255,255,255,0.5); font-family: 'Space Mono'; font-size: 10px; cursor: pointer; text-align: left; padding: 0; }
        .settings-action-row.danger { color: rgba(255,59,59,0.4); }
      `}</style>
    </div>
  );
}
