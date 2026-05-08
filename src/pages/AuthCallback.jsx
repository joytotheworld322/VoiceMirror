import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getUserProfile } from '../lib/userService';

export default function AuthCallback() {
  useEffect(() => {
    async function handleCallback() {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        window.location.href = '/';
        return;
      }

      try {
        const profile = await getUserProfile(session.user.id);
        
        if (!profile || !profile.nickname) {
          // 닉네임 없음 → Step 2부터
          window.location.href = '/?onboarding=nickname';
        } else if (!profile.comfortable_level) {
          // 발화 기준 없음 → Step 3 (ambient)
          window.location.href = '/?onboarding=ambient';
        } else {
          // 기존 유저 → ambient 측정만 → MainView
          window.location.href = '/?onboarding=ambient-only';
        }
      } catch (err) {
        console.error('AuthCallback error:', err);
        window.location.href = '/';
      }
    }
    handleCallback();
  }, []);

  return (
    <div style={{
      background: '#0e0e0e',
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Space Mono, monospace',
      color: 'rgba(255,255,255,0.3)',
      fontSize: '11px',
      letterSpacing: '0.1em',
    }}>
      연결 중...
    </div>
  );
}
