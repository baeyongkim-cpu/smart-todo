import { createClient } from './supabase/client';
import localforage from 'localforage';

export const supabase = createClient();

localforage.config({
  name: 'FocusFlow',
  storeName: 'tasks'
});

// 재시도 큐 전용 스토리지
const syncQueueStore = localforage.createInstance({
  name: 'FocusFlow',
  storeName: 'sync_queue'
});

const isValidUUID = (id) => {
  if (!id || typeof id !== 'string') return false;
  const cleaned = id.trim().toLowerCase();
  if (['null', 'none', 'undefined', '', 'null-null'].includes(cleaned)) return false;
  return cleaned.length > 10;
};

// ─── 재시도 큐 관련 함수 ───

const addToSyncQueue = async (action) => {
  try {
    const queue = (await syncQueueStore.getItem('pending')) || [];
    queue.push({ ...action, timestamp: Date.now() });
    await syncQueueStore.setItem('pending', queue);
  } catch (e) {
    console.error('큐 저장 실패:', e);
  }
};

const processSyncQueue = async (userId) => {
  let queue;
  try {
    queue = (await syncQueueStore.getItem('pending')) || [];
  } catch (e) {
    return;
  }
  if (queue.length === 0) return;

  const remaining = [];

  for (const item of queue) {
    try {
      if (item.type === 'upsert') {
        const { error } = await supabase
          .from('tasks')
          .upsert({ ...item.payload, user_id: userId });
        if (error) {
          remaining.push(item);
        }
      } else if (item.type === 'upsert_batch') {
        const { error } = await supabase
          .from('tasks')
          .upsert(item.payload.map(t => ({ ...t, user_id: userId })));
        if (error) {
          remaining.push(item);
        }
      } else if (item.type === 'delete') {
        const { error } = await supabase
          .from('tasks')
          .delete()
          .eq('id', item.payload.id)
          .eq('user_id', userId);
        if (error) {
          remaining.push(item);
        }
      }
    } catch (err) {
      remaining.push(item);
    }
  }

  await syncQueueStore.setItem('pending', remaining);
  if (remaining.length === 0) {
    console.log('동기화 큐 비움: 모든 작업 서버 전송 완료');
  } else {
    console.warn(`동기화 큐: ${remaining.length}개 작업 재시도 대기`);
  }
};

// ─── 태스크를 서버 포맷으로 변환하는 헬퍼 ───

const toServerFormat = (t, userId) => ({
  id: t.id,
  user_id: userId,
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
});

// ─── 데이터 저장 ───

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
    const serverPayload = tasks.map(t => toServerFormat(t, user.id));
    const { error } = await supabase
      .from('tasks')
      .upsert(serverPayload);
    
    if (error) {
      console.error('Supabase 저장 실패 (RLS 정책을 확인하세요):', error.message);
      // 실패 시 재시도 큐에 추가
      await addToSyncQueue({ type: 'upsert_batch', payload: serverPayload });
    }
  } catch (err) {
    console.error('서버 동기화 중 오류:', err);
    // 네트워크 에러 등 — 재시도 큐에 추가
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await addToSyncQueue({ type: 'upsert_batch', payload: tasks.map(t => toServerFormat(t, user.id)) });
      }
    } catch (_) {}
  }
  return tasks;
};

// 개별 태스크 저장 (전체 리스트 대신 변경된 태스크만 upsert → Realtime 이벤트 1개만 발생)
export const saveOneTask = async (task, allTasks) => {
  // 1. 로컬에 전체 리스트 저장
  await localforage.setItem('tasks', allTasks);
  
  // 2. 서버에는 변경된 태스크 하나만 upsert
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const serverPayload = toServerFormat(task, user.id);
    const { error } = await supabase
      .from('tasks')
      .upsert(serverPayload);
    
    if (error) {
      console.error('개별 태스크 저장 실패:', error.message);
      await addToSyncQueue({ type: 'upsert', payload: serverPayload });
    }
  } catch (err) {
    console.error('개별 태스크 동기화 중 오류:', err);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await addToSyncQueue({ type: 'upsert', payload: toServerFormat(task, user.id) });
      }
    } catch (_) {}
  }
};

// ─── 데이터 삭제 (로컬 먼저 → 서버 후) ───

export const deleteTaskDB = async (id) => {
  // 1. 로컬을 즉시 먼저 삭제 (새로고침 시 복구 방지)
  try {
    const localTasks = await localforage.getItem('tasks');
    if (localTasks) {
      const filtered = localTasks.filter(t => t.id !== id);
      await localforage.setItem('tasks', filtered);
    }
  } catch (localErr) {
    console.error('로컬 삭제 실패:', localErr);
  }

  // 2. 서버에서도 삭제
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Supabase 삭제 실패:', error.message);
        await addToSyncQueue({ type: 'delete', payload: { id } });
      }
    }
  } catch (err) {
    console.error('서버 삭제 처리 중 오류:', err);
    await addToSyncQueue({ type: 'delete', payload: { id } });
  }
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

// ─── 데이터 불러오기 (병합 알고리즘 적용) ───

// 서버 row → 앱 camelCase 변환 헬퍼
const normalizeServerTask = (t) => {
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
};

export const loadTasks = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    // 로그인이 안 되어 있다면 로컬 캐시만 반환하고 절대 덮어쓰지 않음
    if (!user) {
      const local = await localforage.getItem('tasks');
      return local || [];
    }

    // 재시도 큐에 밀려있는 작업이 있으면 먼저 처리
    await processSyncQueue(user.id);

    const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase fetch error:', error);
      const local = await localforage.getItem('tasks');
      return local || [];
    }

    if (data) {
      const serverTasks = data.map(normalizeServerTask);
      
      // ── 병합 알고리즘 ──
      // 1. 서버 태스크를 Map으로 변환
      const serverMap = new Map(serverTasks.map(t => [t.id, t]));
      
      // 2. 로컬 태스크 가져오기
      const localTasks = (await localforage.getItem('tasks')) || [];
      
      // 3. 병합: 서버에 있는 건 서버 우선, 로컬에만 있는 건 보존
      const merged = [];
      const mergedIds = new Set();
      
      // 서버 태스크 전부 추가 (서버가 Single Source of Truth)
      for (const task of serverTasks) {
        merged.push(task);
        mergedIds.add(task.id);
      }
      
      // 로컬에만 있는 태스크 보존 (오프라인에서 추가된 것)
      for (const task of localTasks) {
        if (!mergedIds.has(task.id)) {
          merged.push(task);
          mergedIds.add(task.id);
        }
      }
      
      // 결과를 로컬에만 저장 (서버에 upsert하지 않음 — Realtime 충돌 방지)
      await localforage.setItem('tasks', merged);
      return merged;
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

// ─── 프로필 관련 ───

// 프로필 정보 가져오기 (유료 여부 등)
export const getUserProfile = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    let { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error && error.code === 'PGRST116') {
      // 프로필이 없으면 upsert로 안전하게 생성 (중복 삽입 방지)
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .upsert([{ id: user.id, is_premium: false }], { onConflict: 'id' })
        .select()
        .single();
      
      if (createError) throw createError;
      return newProfile;
    }

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('프로필 로드 실패:', err);
    return { is_premium: false };
  }
};

// 프로필 업데이트 (유료 전환 등)
export const updateUserProfile = async (updates) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (error) throw error;
  } catch (err) {
    console.error('프로필 업데이트 실패:', err);
  }
};
