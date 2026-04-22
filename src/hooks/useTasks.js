import { useState, useEffect, useMemo } from 'react';
import { isToday, isTomorrow, isBefore, startOfDay, addDays } from 'date-fns';
import { loadTasks, saveTasks, clearAllTasksDB, clearRepeatingTasksDB, clearAllIncompleteTasksDB } from '../utils/db';

export const useTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks().then((savedTasks) => {
      // Ensure existing tasks have necessary fields or are parsed correctly, mainly handled in component
      setTasks(savedTasks || []);
      setLoading(false);
    });
  }, []);

  const persistTasks = async (newTasks) => {
    setTasks(newTasks);
    await saveTasks(newTasks);
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
    const newTasks = tasks.map((t) =>
      t.id === id ? { ...t, ...updates } : t
    );
    persistTasks(newTasks);
  };

  const toggleTask = (id) => {
    const newTasks = tasks.map((t) =>
      t.id === id ? { 
        ...t, 
        completed: !t.completed,
        completedAt: !t.completed ? new Date().toISOString() : null
      } : t
    );
    persistTasks(newTasks);
  };

  const deleteTask = (id) => {
    persistTasks(tasks.filter((t) => t.id !== id));
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
