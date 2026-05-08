import { supabase } from './supabase';
import { getDeviceFingerprint } from './deviceFingerprint';

// 앱 시작 시 호출 — 기존 유저면 불러오고, 없으면 생성
export async function getOrCreateUser(nickname) {
  const fp = await getDeviceFingerprint();

  // 기존 유저 조회
  const { data: existing, error: findError } = await supabase
    .from('users')
    .select('*')
    .eq('device_fingerprint', fp)
    .single();

  if (existing) return existing;

  // 신규 유저 생성
  const { data: created, error } = await supabase
    .from('users')
    .insert({ nickname, device_fingerprint: fp })
    .select()
    .single();

  if (error) throw error;
  return created;
}

// 닉네임 변경
export async function updateNickname(userId, nickname) {
  const { error } = await supabase
    .from('users')
    .update({ nickname })
    .eq('id', userId);
  if (error) throw error;
}
