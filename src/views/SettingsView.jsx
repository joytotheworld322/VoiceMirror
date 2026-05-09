import React, { useState, useEffect } from 'react';
import { updateUserProfile } from '../lib/userService';
import { deleteAllSessions } from '../lib/sessionService';
import { signOut } from '../lib/authService';
import { supabase } from '../lib/supabase';
import ConfirmModal from '../components/ConfirmModal';


export default function SettingsView({ user, profile, onBack, onRecalibrate, onProfileUpdate }) {
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState(profile?.nickname || '');
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);


  // 프로필 정보가 변경되면 입력창 상태도 최신화
  useEffect(() => {
    if (!isEditingNickname) {
      setNicknameInput(profile?.nickname || '');
    }
  }, [profile?.nickname, isEditingNickname]);
  
  // 모바일 확대 방지 및 편집 모드 종료 공통 함수
  const closeEdit = () => {
    setIsEditingNickname(false);
    setIsSavingNickname(false);
    setNicknameInput(profile?.nickname || '');
  };

  const handleNicknameSubmit = async (e) => {
    e.preventDefault();
    if (!nicknameInput.trim() || nicknameInput === profile?.nickname) {
      closeEdit();
      return;
    }
    setIsSavingNickname(true);
    try {
      await updateUserProfile(user.id, { nickname: nicknameInput.trim() });
      if (onProfileUpdate) onProfileUpdate();
      closeEdit();
    } catch (e) {
      console.error('닉네임 변경 실패:', e);
      alert('저장에 실패했습니다.');
      setIsSavingNickname(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      // 1. 세션 및 프로필 데이터 선제적 삭제 (CASCADE 미작동 대비)
      await deleteAllSessions(user.id);
      await supabase.from('users').delete().eq('id', user.id);

      // 2. Auth 계정 삭제 요청 (RPC)
      const { error } = await supabase.rpc('delete_user');
      if (error) {
        console.warn('RPC delete_user failed/missing:', error);
      }

      await signOut();
      window.location.reload();
    } catch (e) {
      console.error('탈퇴 실패:', e);
      alert('탈퇴 처리 중 오류가 발생했습니다.');
    }
  };

  const handleLogout = async () => {
    await signOut();
  };


  const formatDate = (dateStr) => {
    if (!dateStr) return '기록 없음';
    const d = new Date(dateStr);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  };

  return (
    <div className="insight-view settings-view" style={{ background: '#0e0e0e' }}>
      <header className="insight-header" style={{ borderBottom: 'none' }}>
        <button className="back-button-text" onClick={onBack} style={{ color: 'white', fontSize: '20px', fontWeight: 'bold' }}>←</button>
        <div />
      </header>

      <div className="settings-scroll-content" style={{ padding: '0 20px 40px' }}>
        <div style={{ marginTop: 24, marginBottom: 32, paddingLeft: 4 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>설정</h2>
        </div>

        <div className="settings-list-group">
          {/* 닉네임 설정 */}
          <div className="settings-item-row">
            <span className="settings-item-label">닉네임</span>
            <div className="settings-item-content">
              {isEditingNickname ? (

                <form onSubmit={handleNicknameSubmit} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: isSavingNickname ? 0.6 : 1 }}>
                  <input 
                    autoFocus 
                    value={nicknameInput} 
                    onChange={e => setNicknameInput(e.target.value)}
                    className="nickname-edit-input"
                    disabled={isSavingNickname}
                    onBlur={() => {
                      if (!nicknameInput.trim() || nicknameInput === profile?.nickname) {
                        closeEdit();
                      }
                    }}
                  />
                  <button type="submit" className="icon-circle-btn primary" disabled={isSavingNickname} style={{ width: 36, height: 36, background: '#4adf84', color: '#0e0e0e', border: 'none' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </button>
                </form>

              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="settings-item-value">{profile?.nickname}</span>
                  <button onClick={() => { setNicknameInput(profile?.nickname || ''); setIsEditingNickname(true); }} className="icon-circle-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 목소리 기준 설정 */}
          <div className="settings-item-row">
            <span className="settings-item-label">목소리 기준</span>
            <div className="settings-item-content">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="settings-item-value">{formatDate(profile?.updated_at)}</span>
                <button onClick={onRecalibrate} className="icon-circle-btn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                </button>
              </div>
            </div>
          </div>
          
          <div className="settings-item-row no-border">
            <span className="settings-item-label">사용 시작일</span>
            <span className="settings-item-value" style={{ opacity: 0.4, fontSize: 13, fontWeight: 500 }}>{formatDate(profile?.created_at)}</span>
          </div>
        </div>

        {/* 계정 관리 섹션 */}
        <div style={{ marginTop: 48 }}>
          <p className="settings-label" style={{ marginBottom: 12 }}>계정 관리</p>
          <div className="settings-list-group">
            <div className="settings-item-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.71a5.41 5.41 0 0 1-.282-1.71c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.443 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500, wordBreak: 'break-all' }}>{user?.email}</span>
              </div>
            </div>
            
            <div className="settings-item-row no-border" style={{ justifyContent: 'flex-start', gap: 20 }}>
              <button onClick={() => setShowLogoutConfirm(true)} className="text-action-btn">로그아웃</button>
              <button onClick={() => setShowDeleteConfirm(true)} className="text-action-btn danger">탈퇴하기</button>
            </div>

          </div>
        </div>
      </div>

      {/* 로그아웃 확인 모달 */}
      <ConfirmModal 
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="정말 로그아웃하시겠어요?"
        message="언제든 다시 돌아와 목소리를 기록해보세요."
        confirmText="로그아웃"
      />


      {/* 탈퇴 확인 모달 */}
      <ConfirmModal 
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteAccount}
        title="정말 탈퇴하시겠어요?"
        message={"탈퇴 시 모든 세션 기록이\n영구적으로 삭제되며 복구할 수 없어요."}
        confirmText="탈퇴하기"
        isDanger={true}
      />


      <style>{`
        .settings-view { height: 100vh; overflow-y: auto; }
        .settings-list-group {
          background: rgba(255,255,255,0.03);
          border-radius: 16px;
          border: 0.5px solid rgba(255,255,255,0.05);
          overflow: hidden;
        }
        .settings-item-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px 16px;
          border-bottom: 0.5px solid rgba(255,255,255,0.06);
          min-height: 72px;
        }
        .settings-item-row.no-border { border-bottom: none; }
        .settings-item-label { font-size: 14px; color: rgba(255,255,255,0.4); font-weight: 500; }
        .settings-item-value { font-size: 16px; color: white; font-weight: 600; }
        
        .icon-circle-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255,255,255,0.06);
          border: 0.5px solid rgba(255,255,255,0.1);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .icon-circle-btn:active {
          background: rgba(255,255,255,0.15);
          transform: scale(0.95);
        }
        
        .text-action-btn {
          background: none;
          border: none;
          color: rgba(255,255,255,0.4);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          padding: 4px 0;
        }
        .text-action-btn.danger { color: rgba(255,82,82,0.5); }
        
        .action-btn-small {
          background: rgba(255,255,255,0.1);
          border: none;
          color: white;
          padding: 0 14px;
          height: 38px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .action-btn-small.primary {
          background: #4adf84;
          color: #0e0e0e;
        }
        
        .nickname-edit-input {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          color: white;
          padding: 0 12px;
          height: 36px;
          font-size: 16px; /* iOS zoom 방지를 위해 16px 이상 유지 */
          outline: none;
          width: 140px;
          text-align: right;
        }

        
        .settings-label { font-size: 12px; color: rgba(255,255,255,0.3); font-weight: 600; letter-spacing: 0.05em; padding-left: 4px; }
      `}</style>
    </div>
  );
}
