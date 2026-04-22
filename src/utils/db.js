import { createClient } from './supabase/client';
import localforage from 'localforage';

export const supabase = createClient();

localforage.config({
  name: 'FocusFlow',
  storeName: 'tasks'
});

// [초강력 판정기] 진짜 반복 업무인지 확인 (UUID 형식의 긴 문자열만 허용)
const isValidUUID = (id) => {
  if (!id || typeof id !== 'string') return false;
  const cleaned = id.trim().toLowerCase();
  if (['null', 'none', 'undefined', '', 'null-null'].includes(cleaned)) return false;
  return cleaned.length > 10; // UUID는 보통 36자이므로 10자 이하는 가짜임
};

// 데이터 저장 시 정제
export const saveTasks = async (tasks) => {
  await localforage.setItem('tasks', tasks);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return tasks;

    const { error } = await supabase
      .from('tasks')
      .upsert(tasks.map(t => ({
        id: t.id,
        user_id: user.id,
        text: t.text || t.title,
        title: t.title || t.text,
        date: t.date,
        duration: t.duration,
        category: t.category,
        priority: t.priority,
        repeat: t.repeat || 'none',
        completed: !!t.completed,
        completed_at: t.completedAt || t.completed_at,
        created_at: t.createdAt || t.created_at,
        // 중요: 유효하지 않은 ID는 진짜 NULL로 저장
        repeat_id: isValidUUID(t.repeatId || t.repeat_id) ? (t.repeatId || t.repeat_id) : null,
        alarm_time: t.alarmTime || t.alarm_time
      })));
    if (error) console.error('Supabase Sync Error:', error);
  } catch (err) {
    console.error('Failed to sync with Supabase:', err);
  }
  return tasks;
};

// 1. 전체 초기화
export const clearAllTasksDB = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('tasks').delete().eq('user_id', user.id);
    await localforage.setItem('tasks', []);
  } catch (err) {
    console.error('전체 초기화 실패:', err);
    throw err;
  }
};

// 2. 모든 미완료 초기화 (기록 절대 보존)
export const clearAllIncompleteTasksDB = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // DB: 미완료 삭제
    await supabase.from('tasks').delete().eq('user_id', user.id).eq('completed', false);

    // 로컬: 완료된 건만 필터링 (원본 훼손 방지)
    const localTasks = await localforage.getItem('tasks');
    if (localTasks) {
      const remaining = localTasks.filter(t => t.completed === true);
      await localforage.setItem('tasks', remaining);
    }
  } catch (err) {
    console.error('미완료 초기화 실패:', err);
    throw err;
  }
};

// 3. 반복 업무 미완료 초기화 (초강력 필터 적용)
export const clearRepeatingTasksDB = async (repeatId = null) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 3.1 DB 작업
    let query = supabase.from('tasks').delete().eq('user_id', user.id).eq('completed', false);
    let upQuery = supabase.from('tasks').update({ repeat: 'none', repeat_id: null }).eq('user_id', user.id).eq('completed', true);

    if (repeatId && isValidUUID(repeatId)) {
      query = query.eq('repeat_id', repeatId);
      upQuery = upQuery.eq('repeat_id', repeatId);
    } else {
      // "null", "none" 등을 제외한 진짜 ID만 타겟팅
      query = query.not('repeat_id', 'is', null).neq('repeat_id', 'null').neq('repeat_id', 'none');
      upQuery = upQuery.not('repeat_id', 'is', null).neq('repeat_id', 'null').neq('repeat_id', 'none');
    }

    await query;
    await upQuery;
    
    // 3.2 로컬 업데이트 (가장 안전한 방식)
    const localTasks = await localforage.getItem('tasks');
    if (localTasks) {
      const updated = localTasks.map(t => {
        // 이 업무가 타겟 반복 업무인가?
        const isTarget = repeatId ? (t.repeatId === repeatId) : isValidUUID(t.repeatId);
        
        if (isTarget) {
          if (t.completed) {
            // 완료된 건 규칙만 제거하여 보존
            return { ...t, repeat: 'none', repeatId: null };
          }
          return null; // 미완료 반복만 삭제
        }
        return t; // 일반 업무(미완료 포함)는 100% 무조건 보존
      }).filter(Boolean);
      await localforage.setItem('tasks', updated);
    }
  } catch (err) {
    console.error('반복 업무 초기화 실패:', err);
    throw err;
  }
};

// 데이터 불러오기 (불러올 때 즉시 청소)
export const loadTasks = async () => {
  try {
    const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      const cleaned = data.map(t => {
        const rId = isValidUUID(t.repeat_id) ? t.repeat_id : null;
        return {
          id: t.id,
          text: t.text,
          title: t.title,
          date: t.date,
          duration: t.duration,
          category: t.category,
          priority: t.priority,
          repeat: rId ? (t.repeat || 'none') : 'none',
          completed: !!t.completed,
          completedAt: t.completed_at,
          createdAt: t.created_at,
          repeatId: rId,
          alarmTime: t.alarm_time
        };
      });
      await localforage.setItem('tasks', cleaned);
      return cleaned;
    }
  } catch (err) {
    console.error('Load Error:', err);
  }
  const localTasks = await localforage.getItem('tasks');
  return localTasks || [];
};
