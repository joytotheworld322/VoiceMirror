import React, { useState } from 'react';
import { updateNickname } from '../lib/userService';
import { deleteAllSessions } from '../lib/sessionService';
import { LOCAL_STORAGE_KEYS } from '../constants';

export default function SettingsView({ user, onBack, onRecalibrate, onNicknameUpdate }) {
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState(user?.nickname || '');

  const handleNicknameSubmit = async (e) => {
    e.preventDefault();
    if (!nicknameInput.trim() || nicknameInput === user.nickname) {
      setIsEditingNickname(false);
      return;
    }
    try {
      await updateNickname(user.id, nicknameInput.trim());
      localStorage.setItem(LOCAL_STORAGE_KEYS.NICKNAME, nicknameInput.trim());
      onNicknameUpdate(nicknameInput.trim());
      setIsEditingNickname(false);
    } catch (e) {
      console.error('닉네임 변경 실패:', e);
      alert('닉네임 변경에 실패했습니다.');
    }
  };

  const handleDeleteData = async () => {
    if (window.confirm("정말 삭제할까요? 이 작업은 되돌릴 수 없어요.")) {
      try {
        await deleteAllSessions(user.id);
        localStorage.removeItem(LOCAL_STORAGE_KEYS.AMBIENT_BASELINE);
        localStorage.removeItem(LOCAL_STORAGE_KEYS.COMFORTABLE_LEVEL);
        localStorage.removeItem(LOCAL_STORAGE_KEYS.ONBOARDING_COMPLETE);
        window.location.reload();
      } catch (e) {
        console.error('데이터 삭제 실패:', e);
        alert('데이터 삭제에 실패했습니다.');
      }
    }
  };

  return (
    <div className="insight-view settings-view">
      <header className="insight-header">
        <span className="app-name-small">VOICEMIRROR v2</span>
        <button className="back-button-text" onClick={onBack}>←</button>
      </header>

      <div className="insight-scroll-content">
        <section className="settings-item">
          <p className="settings-label">닉네임</p>
          {isEditingNickname ? (
            <form onSubmit={handleNicknameSubmit}>
              <input
                type="text"
                className="nickname-input-inline"
                autoFocus
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                onBlur={() => setIsEditingNickname(false)}
              />
            </form>
          ) : (
            <div className="settings-value-row" onClick={() => setIsEditingNickname(true)}>
              <span className="settings-value">{user?.nickname}</span>
              <span className="settings-action">변경 →</span>
            </div>
          )}
        </section>

        <section className="settings-item">
          <p className="settings-label">목소리 기준</p>
          <div className="settings-value-row" onClick={onRecalibrate}>
            <span className="settings-value">마지막 측정: 온보딩 시</span>
            <span className="settings-action">재측정 →</span>
          </div>
        </section>

        <section className="settings-item danger-zone" style={{ marginTop: 'auto', paddingTop: 40 }}>
          <p className="settings-label" style={{ color: '#ff3b3b' }}>위험 영역</p>
          <div className="settings-value-row" onClick={handleDeleteData}>
            <div className="settings-text-group">
              <span className="settings-value">데이터 전체 삭제</span>
              <span className="settings-desc">모든 세션 기록이 삭제됩니다.</span>
            </div>
            <button className="delete-button">삭제</button>
          </div>
        </section>
      </div>
    </div>
  );
}
