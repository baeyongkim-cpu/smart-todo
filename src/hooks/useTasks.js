import { useState, useEffect, useMemo } from 'react';
import { isToday, isTomorrow, isBefore, startOfDay, addDays } from 'date-fns';
import { loadTasks, saveTasks } from '../utils/db';

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
    const newTask = {
      id: crypto.randomUUID(),
      text: taskObj.text,
      title: taskObj.text, // For compatibility
      date: taskObj.date || new Date().toISOString(),
      duration: taskObj.duration || 30, // minutes
      alarmTime: taskObj.alarmTime || null,
      category: taskObj.category || 'home',
      priority: taskObj.priority || 'medium',
      repeat: taskObj.repeat || 'none', // 'none', 'daily', 'weekdays', 'weekly'
      completed: false,
      createdAt: new Date().toISOString(),
    };
    persistTasks([newTask, ...tasks]);
  };

  const updateTask = (id, updates) => {
    const newTasks = tasks.map((t) =>
      t.id === id ? { ...t, ...updates } : t
    );
    persistTasks(newTasks);
  };

  const toggleTask = (id) => {
    let tasksToSave = [...tasks];
    const taskIndex = tasksToSave.findIndex(t => t.id === id);
    if (taskIndex > -1) {
      const task = tasksToSave[taskIndex];
      const isCompleting = !task.completed;
      tasksToSave[taskIndex] = { 
        ...task, 
        completed: isCompleting,
        completedAt: isCompleting ? new Date().toISOString() : null
      };
      
      // Handle repeating tasks spawning and despawning
      if (task.repeat && task.repeat !== 'none') {
        if (isCompleting) {
           let baseDate = new Date(task.date || task.createdAt);
           let nextDate = new Date();
           
           if (task.repeat === 'daily') {
             nextDate = addDays(baseDate, 1);
           } else if (task.repeat === 'weekly') {
             nextDate = addDays(baseDate, 7);
           } else if (task.repeat === 'weekdays') {
             const day = baseDate.getDay();
             if (day === 5) nextDate = addDays(baseDate, 3); // Fri -> Mon
             else if (day === 6) nextDate = addDays(baseDate, 2); // Sat -> Mon
             else nextDate = addDays(baseDate, 1);
           } else if (task.repeat.startsWith('days:')) {
             const allowedDays = task.repeat.split(':')[1].split(',').map(Number);
             if (allowedDays.length > 0) {
               let candidate = addDays(baseDate, 1);
               for(let i=0; i<7; i++) {
                 if (allowedDays.includes(candidate.getDay())) break;
                 candidate = addDays(candidate, 1);
               }
               nextDate = candidate;
             }
           } else if (task.repeat.startsWith('monthly:')) {
             const targetDate = parseInt(task.repeat.split(':')[1], 10);
             nextDate = new Date(baseDate);
             nextDate.setMonth(nextDate.getMonth() + 1);
             const daysInMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
             nextDate.setDate(Math.min(targetDate, daysInMonth));
           }

           const newTask = {
             ...task,
             id: crypto.randomUUID(),
             completed: false,
             date: nextDate.toISOString(),
             createdAt: new Date().toISOString()
           };
           tasksToSave.unshift(newTask);

        } else {
           // If un-completing, attempt to find and delete the unedited future spawn
           const spawnIndex = tasksToSave.findIndex(t => 
              t.text === task.text && 
              !t.completed && 
              new Date(t.createdAt) > new Date(task.createdAt) &&
              new Date(t.date) > new Date(task.date || task.createdAt)
           );
           if (spawnIndex > -1) {
              tasksToSave.splice(spawnIndex, 1);
           }
        }
      }
    }
    persistTasks(tasksToSave);
  };

  const deleteTask = (id) => {
    persistTasks(tasks.filter((t) => t.id !== id));
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

  return {
    tasks,
    groupedTasks,
    progress,
    loading,
    addTask,
    updateTask,
    toggleTask,
    deleteTask,
  };
};
