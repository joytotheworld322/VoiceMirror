import { supabase } from './supabase';

// 현재 유저 프로필 가져오기
export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// 프로필 저장 및 업데이트 (에러 방지 강화 버전)
export async function updateUserProfile(userId, updates) {
  const now = new Date().toISOString();

  // 1. 먼저 업데이트(Update)를 시도합니다.
  // 업데이트는 지정된 컬럼만 건드리므로 닉네임 누락 에러가 발생하지 않습니다.
  const { data, error: updateError } = await supabase
    .from('users')
    .update({ 
      ...updates, 
      updated_at: now 
    })
    .eq('id', userId)
    .select();

  if (updateError) {
    console.error('Update attempt failed:', updateError);
    throw updateError;
  }

  // 2. 만약 업데이트된 행이 없다면(데이터가 없다는 뜻), 새로 생성(Insert)합니다.
  if (!data || data.length === 0) {
    // 신규 생성 시에는 최소한의 닉네임 정보가 필요할 수 있으므로 체크
    if (!updates.nickname) {
      // 닉네임이 없는 상태에서 생성을 시도해야 한다면 임시 닉네임이라도 부여하거나 에러 처리
      console.warn('No existing profile found. Attempting to create one...');
      // 이 경우는 보통 최초 닉네임 설정 단계에서 처리되어야 함
    }

    const { error: insertError } = await supabase
      .from('users')
      .insert({ 
        id: userId,
        nickname: updates.nickname || 'User', // 닉네임이 없으면 기본값이라도 설정
        ...updates, 
        updated_at: now 
      });

    if (insertError) {
      console.error('Insert attempt failed:', insertError);
      throw insertError;
    }
  }

  // Auth metadata 동기화
  await supabase.auth.updateUser({
    data: updates
  });
}
