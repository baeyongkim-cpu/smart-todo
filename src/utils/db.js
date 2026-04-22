import { createClient } from './supabase/client';
import localforage from 'localforage';

export const supabase = createClient();

localforage.config({
  name: 'FocusFlow',
  storeName: 'tasks'
});

const isValidUUID = (id) => {
  if (!id || typeof id !== 'string') return false;
  const cleaned = id.trim().toLowerCase();
  if (['null', 'none', 'undefined', '', 'null-null'].includes(cleaned)) return false;
  return cleaned.length > 10;
};

// 데이터 저장
export const saveTasks = async (tasks) => {
  // 1. 로컬에 먼저 안전하게 저장
  await localforage.setItem('tasks', tasks);
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('로그인된 사용자가 없어 서버 동기화를 건너뜁니다.');
      return tasks;
    }

    // 2. 서버 업서트 (RLS 정책이 필요함)
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
        repeat_id: isValidUUID(t.repeatId || t.repeat_id) ? (t.repeatId || t.repeat_id) : null,
        alarm_time: t.alarmTime || t.alarm_time
      })));
    
    if (error) {
      console.error('Supabase 저장 실패 (RLS 정책을 확인하세요):', error.message);
    }
  } catch (err) {
    console.error('서버 동기화 중 오류:', err);
  }
  return tasks;
};

// 모든 미완료 초기화
export const clearAllIncompleteTasksDB = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('tasks').delete().eq('user_id', user.id).eq('completed', false);
    }
    const localTasks = await localforage.getItem('tasks');
    if (localTasks) {
      const remaining = localTasks.filter(t => t.completed === true);
      await localforage.setItem('tasks', remaining);
    }
  } catch (err) {
    console.error('초기화 실패:', err);
  }
};

// 반복 업무 초기화
export const clearRepeatingTasksDB = async (repeatId = null) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      let query = supabase.from('tasks').delete().eq('user_id', user.id).eq('completed', false);
      let upQuery = supabase.from('tasks').update({ repeat: 'none', repeat_id: null }).eq('user_id', user.id).eq('completed', true);

      if (repeatId && isValidUUID(repeatId)) {
        query = query.eq('repeat_id', repeatId);
        upQuery = upQuery.eq('repeat_id', repeatId);
      } else {
        query = query.not('repeat_id', 'is', null).neq('repeat_id', 'null').neq('repeat_id', 'none');
        upQuery = upQuery.not('repeat_id', 'is', null).neq('repeat_id', 'null').neq('repeat_id', 'none');
      }
      await query;
      await upQuery;
    }
    
    const localTasks = await localforage.getItem('tasks');
    if (localTasks) {
      const updated = localTasks.map(t => {
        const isTarget = repeatId ? (t.repeatId === repeatId) : isValidUUID(t.repeatId);
        if (isTarget) {
          if (t.completed) return { ...t, repeat: 'none', repeatId: null };
          return null;
        }
        return t;
      }).filter(Boolean);
      await localforage.setItem('tasks', updated);
    }
  } catch (err) {
    console.error('반복 초기화 실패:', err);
  }
};

// 데이터 불러오기 (보호막 강화)
export const loadTasks = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    // 로그인이 안 되어 있다면 로컬 캐시만 반환하고 절대 덮어쓰지 않음
    if (!user) {
      console.log('로그인 전: 로컬 데이터를 유지합니다.');
      const local = await localforage.getItem('tasks');
      return local || [];
    }

    const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase fetch error:', error);
      const local = await localforage.getItem('tasks');
      return local || [];
    }

    if (data) {
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
      
      // 서버 응답이 성공(data가 존재)하면 0개라도 로컬을 동기화함
      await localforage.setItem('tasks', cleaned);
      return cleaned;
    }
  } catch (err) {
    console.error('Load Error:', err);
  }
  const localTasks = await localforage.getItem('tasks');
  return localTasks || [];
};

export const clearAllTasksDB = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await supabase.from('tasks').delete().eq('user_id', user.id);
  await localforage.setItem('tasks', []);
};
