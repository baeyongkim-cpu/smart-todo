import { useState, useEffect, useMemo, useRef } from 'react';
import { isToday, isTomorrow, isBefore, startOfDay, addDays } from 'date-fns';
import { loadTasks, saveTasks, saveOneTask, deleteTaskDB, clearAllTasksDB, clearRepeatingTasksDB, clearAllIncompleteTasksDB, supabase } from '../utils/db';

export const useTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // 1. 초기 데이터 로드
    loadTasks()
      .then((savedTasks) => {
        if (isMounted) setTasks(savedTasks || []);
      })
      .catch((err) => {
        console.error('초기 데이터 로드 중 오류:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    // 2. 실시간 동기화 구독 (PC-폰 간 즉시 반영 — payload 기반)
    let channel;

    // Supabase snake_case → 앱 camelCase 변환 헬퍼
    const isValidUUID = (id) => {
      if (!id || typeof id !== 'string') return false;
      const cleaned = id.trim().toLowerCase();
      if (['null', 'none', 'undefined', '', 'null-null'].includes(cleaned)) return false;
      return cleaned.length > 10;
    };
    const normalizeTask = (t) => ({
      id: t.id,
      text: t.text,
      title: t.title,
      date: t.date,
      duration: t.duration,
      category: t.category,
      priority: t.priority,
      repeat: isValidUUID(t.repeat_id) ? (t.repeat || 'none') : 'none',
      completed: !!t.completed,
      completedAt: t.completed_at,
      createdAt: t.created_at,
      repeatId: isValidUUID(t.repeat_id) ? t.repeat_id : null,
      alarmTime: t.alarm_time
    });

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isMounted) return;

      // 이미 구독 중인 동일 이름의 채널이 있다면 제거 (Strict Mode 중복 호출 방지)
      const existingChannel = supabase.getChannels().find(c => c.name === 'tasks-realtime-sync');
      if (existingChannel) {
        await supabase.removeChannel(existingChannel);
      }

      if (!isMounted) return;

      channel = supabase
        .channel(`tasks-sync-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*', 
            schema: 'public',
            table: 'tasks'
            // Removing filter for DELETE support: Supabase DELETE payloads only contain ID by default.
            // With a filter, DELETE events are blocked because the 'old' record lacks 'user_id'.
          },
          (payload) => {
            if (!isMounted) return;
            const eventType = payload.eventType;

            // Handle deletions and updates specifically to avoid ghosting
            const targetId = eventType === 'DELETE' ? payload.old?.id : payload.new?.id;
            if (targetId && recentlyModified.current.has(targetId)) {
              console.log(`실시간: ${targetId} 최근 수정/삭제됨 → 이벤트 무시`);
              return;
            }

            if (eventType === 'INSERT') {
              const newTask = normalizeTask(payload.new);
              setTasks(prev => {
                if (prev.some(t => t.id === newTask.id)) return prev;
                return [newTask, ...prev];
              });
            } else if (eventType === 'UPDATE') {
              const updated = normalizeTask(payload.new);
              setTasks(prev => {
                const idx = prev.findIndex(t => t.id === updated.id);
                if (idx === -1) return prev;
                const existing = prev[idx];
                if (existing.completed === updated.completed &&
                    existing.text === updated.text &&
                    existing.title === updated.title &&
                    existing.category === updated.category &&
                    existing.priority === updated.priority &&
                    existing.date === updated.date) {
                  return prev;
                }
                const next = [...prev];
                next[idx] = updated;
                return next;
              });
            } else if (eventType === 'DELETE') {
              const deletedId = payload.old?.id;
              if (deletedId) {
                setTasks(prev => prev.filter(t => t.id !== deletedId));
              }
            }
            console.log(`실시간 동기화: ${eventType} 처리 완료`);
          }
        )
        .subscribe();
    };

    setupRealtime();

    // 3. 장시간 비활성 후 복귀 시에만 동기화 (30초 이상 비활성)
    let lastActiveTime = Date.now();

    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        const inactiveDuration = Date.now() - lastActiveTime;
        // 30초 이상 비활성 상태였을 때만 서버에서 새로고침
        if (inactiveDuration > 30000) {
          console.log('장시간 비활성 후 복귀: 데이터 동기화');
          const freshTasks = await loadTasks();
          if (isMounted) setTasks(freshTasks);
        }
      } else {
        lastActiveTime = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // 최근 수정된 태스크 ID 추적 (Realtime 자기 이벤트 무시용)
  const recentlyModified = useRef(new Map());
  const modifiedTimers = useRef(new Map());
  // 서버 저장 디바운스용
  const saveTimers = useRef(new Map());
  const latestTasksRef = useRef([]);

  // tasks 상태가 변경될 때마다 ref 동기화
  useEffect(() => {
    latestTasksRef.current = tasks;
  }, [tasks]);

  const markModified = (id) => {
    recentlyModified.current.set(id, Date.now());
    // 기존 타이머 정리 후 새로 설정 (마지막 수정 기준 5초)
    if (modifiedTimers.current.has(id)) {
      clearTimeout(modifiedTimers.current.get(id));
    }
    modifiedTimers.current.set(id, setTimeout(() => {
      recentlyModified.current.delete(id);
      modifiedTimers.current.delete(id);
    }, 5000));
  };

  // 서버 저장 디바운스: 빠른 토글 시 마지막 상태만 서버에 전송
  const debouncedServerSave = (id) => {
    if (saveTimers.current.has(id)) {
      clearTimeout(saveTimers.current.get(id));
    }
    saveTimers.current.set(id, setTimeout(() => {
      saveTimers.current.delete(id);
      const allTasks = latestTasksRef.current;
      const task = allTasks.find(t => t.id === id);
      if (task) {
        saveOneTask(task, allTasks).catch(err => console.error('서버 동기화 실패:', err));
      }
    }, 600));
  };

  const persistTasks = (newTasks) => {
    setTasks(newTasks);
    saveTasks(newTasks).catch(err => console.error('서버 동기화 실패:', err));
  };

  const addTask = (taskObj) => {
    const repeatId = taskObj.repeat !== 'none' ? crypto.randomUUID() : null;
    const baseDate = new Date(taskObj.date || new Date().toISOString());
    const instances = [];
    
    // Number of instances to pre-register
    let count = 1;
    if (taskObj.repeat !== 'none') {
      count = taskObj.repeat.startsWith('monthly') ? 12 : 30; 
    }

    let currentDate = new Date(baseDate);

    for (let i = 0; i < count; i++) {
      // Calculate next date for the instance
      if (i > 0) {
        if (taskObj.repeat === 'daily') {
          currentDate = addDays(currentDate, 1);
        } else if (taskObj.repeat === 'weekly') {
          currentDate = addDays(currentDate, 7);
        } else if (taskObj.repeat === 'weekdays') {
          currentDate = addDays(currentDate, 1);
          while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
            currentDate = addDays(currentDate, 1);
          }
        } else if (taskObj.repeat.startsWith('days:')) {
          const allowedDays = taskObj.repeat.split(':')[1].split(',').map(Number);
          currentDate = addDays(currentDate, 1);
          while (!allowedDays.includes(currentDate.getDay())) {
            currentDate = addDays(currentDate, 1);
          }
        } else if (taskObj.repeat.startsWith('monthly:')) {
          const targetDay = parseInt(taskObj.repeat.split(':')[1], 10);
          currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
          const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
          currentDate.setDate(Math.min(targetDay, daysInMonth));
        } else {
          break; // Should not happen if repeat is set correctly
        }
      }

      instances.push({
        id: crypto.randomUUID(),
        repeatId: repeatId,
        text: taskObj.text,
        title: taskObj.text,
        date: currentDate.toISOString(),
        duration: taskObj.duration || 30,
        alarmTime: taskObj.alarmTime || null,
        category: taskObj.category || 'home',
        priority: taskObj.priority || 'medium',
        repeat: taskObj.repeat || 'none',
        completed: false,
        createdAt: new Date().toISOString(),
      });
    }
    
    persistTasks([...instances, ...tasks]);
  };

  const updateTask = (id, updates) => {
    markModified(id);
    setTasks(prev => {
      const newTasks = prev.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      );
      return newTasks;
    });
    // 서버 저장은 디바운스 (마지막 상태만 전송)
    debouncedServerSave(id);
  };

  const toggleTask = (id) => {
    markModified(id);
    setTasks(prev => {
      const newTasks = prev.map((t) =>
        t.id === id ? { 
          ...t, 
          completed: !t.completed,
          completedAt: !t.completed ? new Date().toISOString() : null
        } : t
      );
      return newTasks;
    });
    // 서버 저장은 디바운스 (마지막 상태만 전송)
    debouncedServerSave(id);
  };

  const deleteTask = async (id) => {
    try {
      // 1. 상태에서 즉시 제거 및 추적 시작 (UI 반응성 + 동기화 충돌 방지)
      recentlyModified.current.set(id, Date.now());
      setTasks(prev => prev.filter(t => t.id !== id));
      
      // 2. DB 삭제 (비동기)
      await deleteTaskDB(id);
      
      // 일정 시간 후 추적 제거 (실시간 이벤트 지연 고려)
      setTimeout(() => recentlyModified.current.delete(id), 5000);
    } catch (err) {
      console.error('삭제 실패:', err);
    }
  };

  const resetAllTasks = async () => {
    try {
      await clearAllTasksDB();
      setTasks([]);
    } catch (err) {
      console.error("전체 초기화 중 오류가 발생했습니다:", err);
    }
  };

  const resetAllIncompleteTasks = async () => {
    // 2. 미완료 초기화 (모든 미완료 삭제)
    const updatedTasks = tasks.filter(t => t.completed);
    setTasks([...updatedTasks]);

    try {
      await clearAllIncompleteTasksDB();
    } catch (err) {
      console.error("미완료 초기화 중 오류가 발생했습니다:", err);
      const saved = await loadTasks();
      setTasks(saved);
    }
  };

  // 반복 업무 판별 도우미 (UUID 형식의 긴 문자열만 허용)
  const isRepeatingTask = (t) => {
    if (!t.repeatId || typeof t.repeatId !== 'string') return false;
    const cleaned = t.repeatId.trim().toLowerCase();
    if (['null', 'none', 'undefined', '', 'null-null'].includes(cleaned)) return false;
    return cleaned.length > 10;
  };

  const resetAllRepeatingIncompleteTasks = async () => {
    // 3. 반복 업무 미완료 일괄 초기화
    const updatedTasks = tasks.map(t => {
      // 1. 모든 완료된 업무는 어떤 경우에도 보존
      if (t.completed) {
        // 이 업무가 진짜 반복 업무라면 규칙만 제거
        if (isRepeatingTask(t)) return { ...t, repeat: 'none', repeatId: null };
        return t; // 일반 완료 업무 보존
      }
      
      // 2. 미완료 중 진짜 반복 업무만 삭제
      if (isRepeatingTask(t)) return null;
      
      // 3. 일반 미완료 업무는 100% 무조건 보존
      return t;
    }).filter(Boolean);
    setTasks([...updatedTasks]);

    try {
      await clearRepeatingTasksDB();
    } catch (err) {
      console.error("반복 업무 일괄 초기화 중 오류가 발생했습니다:", err);
      const saved = await loadTasks();
      setTasks(saved);
    }
  };

  const resetRepeatingTask = async (repeatId) => {
    if (!repeatId || !isRepeatingTask({ repeatId })) return;

    // 개별 반복 업무 초기화
    const updatedTasks = tasks.map(t => {
      // 완료된 건 무조건 유지
      if (t.completed) {
        // 해당 반복 업무라면 규칙만 제거
        if (t.repeatId === repeatId) return { ...t, repeat: 'none', repeatId: null };
        return t;
      }
      // 미완료 중 해당 반복 업무만 삭제
      if (t.repeatId === repeatId) return null;
      
      // 다른 모든 업무(일반 업무 포함) 유지
      return t;
    }).filter(Boolean);
    setTasks([...updatedTasks]);

    try {
      await clearRepeatingTasksDB(repeatId);
    } catch (err) {
      console.error("반복 업무 개별 초기화 중 오류가 발생했습니다:", err);
      const saved = await loadTasks();
      setTasks(saved);
    }
  };

  // Grouped Tasks for backward compatibility if needed
  const groupedTasks = useMemo(() => {
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);

    return {
      overdue: tasks.filter(t => !t.completed && isBefore(startOfDay(new Date(t.date || t.createdAt)), today)),
      today: tasks.filter(t => isToday(new Date(t.date || t.createdAt))),
      tomorrowCount: tasks.filter(t => isTomorrow(new Date(t.date || t.createdAt))).length,
      allToday: tasks.filter(t => isToday(new Date(t.date || t.createdAt))),
    };
  }, [tasks]);

  const progress = useMemo(() => {
    const todayTasks = tasks; // Base progress on all active tasks or today's tasks
    if (todayTasks.length === 0) return 0;
    const completed = todayTasks.filter(t => t.completed).length;
    return Math.round((completed / todayTasks.length) * 100);
  }, [tasks]);

  const repeatingTaskGroups = useMemo(() => {
    const groups = {};
    tasks.forEach(t => {
      if (t.repeatId && !groups[t.repeatId]) {
        groups[t.repeatId] = {
          id: t.repeatId,
          text: t.text || t.title,
          repeat: t.repeat,
          category: t.category,
          count: tasks.filter(item => item.repeatId === t.repeatId).length,
          uncompletedCount: tasks.filter(item => item.repeatId === t.repeatId && !item.completed).length
        };
      }
    });
    return Object.values(groups);
  }, [tasks]);

  return {
    tasks,
    loading,
    addTask,
    updateTask,
    toggleTask,
    deleteTask,
    resetAllTasks,
    resetAllIncompleteTasks,
    resetAllRepeatingIncompleteTasks,
    resetRepeatingTask,
    progress,
    repeatingTaskGroups
  };
};
