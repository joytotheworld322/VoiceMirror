import { supabase } from './supabase';

// Google 로그인
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        prompt: 'select_account',
      },
    },
  });
  if (error) throw error;
}

// 현재 세션 가져오기
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// 로그아웃
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// 유저 메타데이터 업데이트 (Auth 전용 - 선택적 사용)
export async function updateAuthUser(updates) {
  const { error } = await supabase.auth.updateUser({
    data: updates,
  });
  if (error) throw error;
}
