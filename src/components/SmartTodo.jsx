import React, { useState, useMemo, useEffect } from "react";
import { Plus, Check, Trash2, Clock, Zap, Home, Calendar as CalendarIcon, Star, Repeat, Timer, BarChart, ChevronLeft, ChevronRight, Settings, Palette, Type, Heart, Smile, Coffee, Target, Lightbulb, LogOut, CalendarX, Briefcase, User, Globe, Tag } from "lucide-react";
import { supabase } from "../utils/db";
import { cn } from "../lib/utils";
import { useTasks } from "../hooks/useTasks";
import { startOfDay, addDays, subDays, isSameDay, format, startOfMonth, endOfMonth, eachDayOfInterval, endOfWeek, startOfWeek } from "date-fns";
import { ko, enUS } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

const categoryConfig = {
  home: { icon: Home, label: "category_home", color: "from-cyan-500 to-teal-500" },
  work: { icon: Briefcase, label: "category_work", color: "from-indigo-500 to-purple-500" },
  personal: { icon: User, label: "category_personal", color: "from-rose-500 to-orange-500" },
};

const priorityConfig = {
  low: { label: "priority_low", color: "from-emerald-500 to-green-500", dot: "bg-emerald-500" },
  medium: { label: "priority_medium", color: "from-amber-500 to-orange-400", dot: "bg-amber-500" },
  high: { label: "priority_high", color: "from-rose-500 to-red-600", dot: "bg-rose-500" },
};

const iconMap = {
  Zap, Home, Star, Target, Coffee
};

// Quotes moved to i18n.js

export function SmartTodo() {
  const { t, i18n } = useTranslation();
  const { tasks, loading, addTask, updateTask, toggleTask, deleteTask, resetAllTasks, resetRepeatingTask, resetAllIncompleteTasks, resetAllRepeatingIncompleteTasks, repeatingTaskGroups } = useTasks();

  const [activeTab, setActiveTab] = useState("home"); // 'home' | 'stats'
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState('main'); // 'main', 'reset', 'language'
  const [confirmState, setConfirmState] = useState(null); // { title: string, message: string, action: function }

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('smart-todo-settings');
    return saved ? JSON.parse(saved) : {
      bgColor: 'linear-gradient(to bottom, #09090b, #18181b)',
      appTitle: 'Smart Tasks',
      appIcon: 'Zap',
      accentColor: 'cyan'
    };
  });

  useEffect(() => {
    localStorage.setItem('smart-todo-settings', JSON.stringify(settings));
  }, [settings]);

  const [newTodo, setNewTodo] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("home");
  const [selectedPriority, setSelectedPriority] = useState("medium");
  const [selectedDuration, setSelectedDuration] = useState(30);
  
  const [repeatModalState, setRepeatModalState] = useState({ isOpen: false, targetId: null, type: 'none', payload: '' });
  const [newTodoRepeat, setNewTodoRepeat] = useState("none"); // Default for new UI

  const [completeModalState, setCompleteModalState] = useState({ isOpen: false, task: null, duration: 30 });

  const quote = useMemo(() => {
    const quotesList = t('quotes', { returnObjects: true });
    if (!Array.isArray(quotesList)) return "";
    const date = new Date().getDate();
    return quotesList[(date - 1) % quotesList.length];
  }, [t]);

  const handleAddTodo = () => {
    if (!newTodo.trim()) return;
    addTask({
      text: newTodo,
      category: selectedCategory,
      priority: selectedPriority,
      duration: parseInt(selectedDuration),
      repeat: newTodoRepeat,
      date: selectedDate.toISOString(),
    });
    setNewTodo("");
    setSelectedDuration(30);
    setNewTodoRepeat("none");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handlePrevDay = () => setSelectedDate(prev => subDays(prev, 1));
  const handleNextDay = () => setSelectedDate(prev => addDays(prev, 1));
  const handleGoToday = () => setSelectedDate(startOfDay(new Date()));

  const today = startOfDay(new Date());
  
  // Filter all tasks (completed and uncompleted) for the selected date
  const selectedDateTasks = tasks.filter((todo) => {
    const taskDate = startOfDay(new Date(todo.date || todo.createdAt));
    return isSameDay(taskDate, selectedDate);
  });

  // Sort: Uncompleted first, then by creation time
  const sortedTasks = [...selectedDateTasks].sort((a, b) => {
    if (a.completed === b.completed) return 0;
    return a.completed ? 1 : -1;
  });

  const uncompletedCount = selectedDateTasks.filter(t => !t.completed).length;
  const uncompletedTodos = selectedDateTasks.filter(t => !t.completed);
  const completedCount = selectedDateTasks.filter(t => t.completed).length;
  const totalCount = selectedDateTasks.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const currentLocale = i18n.language.startsWith('en') ? enUS : ko;
  const todayStr = format(selectedDate, i18n.language.startsWith('en') ? 'EEEE, MMM d, yyyy' : 'yyyy. MM. dd. (EEEE)', { locale: currentLocale });
  const isSelectedToday = isSameDay(selectedDate, startOfDay(new Date()));
  const AppIcon = iconMap[settings.appIcon] || Zap;

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div></div>;
  }

  const handleToggleTaskWithConfirm = (task) => {
    if (task.completed) {
      toggleTask(task.id);
    } else {
      setCompleteModalState({ isOpen: true, task, duration: task.duration || 30 });
    }
  };

  const confirmCompletion = () => {
    const { task, duration } = completeModalState;
    if (task) {
      // duration과 완료 상태를 한 번에 업데이트 (2번 저장으로 인한 레이스 컨디션 방지)
      updateTask(task.id, { 
        duration: parseInt(duration),
        completed: true,
        completedAt: new Date().toISOString()
      });
    }
    setCompleteModalState({ isOpen: false, task: null, duration: 30 });
  };

  const openRepeatModalFor = (target) => {
    let initialType = 'none';
    let initialPayload = '';
    const repeatStr = target === 'new' ? newTodoRepeat : (tasks.find(t => t.id === target)?.repeat || 'none');
    
    if (repeatStr.startsWith('days:')) {
      initialType = 'days';
      initialPayload = repeatStr.split(':')[1];
    } else if (repeatStr.startsWith('monthly:')) {
      initialType = 'monthly';
      initialPayload = repeatStr.split(':')[1];
    } else {
      initialType = repeatStr;
    }
    
    setRepeatModalState({ isOpen: true, targetId: target, type: initialType, payload: initialPayload });
  };

  const saveRepeatModal = () => {
    const { targetId, type, payload } = repeatModalState;
    let computedRepeat = type;
    if (type === 'days') computedRepeat = `days:${payload ? payload : '1,2,3,4,5'}`;
    if (type === 'monthly') computedRepeat = `monthly:${payload ? payload : '1'}`;

    if (targetId === 'new') {
      setNewTodoRepeat(computedRepeat);
    } else {
      updateTask(targetId, { repeat: computedRepeat });
    }
    setRepeatModalState({ ...repeatModalState, isOpen: false });
  };

  const formatRepeatLabel = (repeatStr) => {
    if (!repeatStr || repeatStr === 'none') return t('repeat_none');
    if (repeatStr === 'daily') return t('repeat_daily');
    if (repeatStr === 'weekdays') return t('repeat_weekdays');
    if (repeatStr === 'weekly') return t('repeat_weekly');
    if (repeatStr.startsWith('days:')) {
      const days = repeatStr.split(':')[1].split(',').map(Number);
      const names = t('days_short', { returnObjects: true });
      return days.map(d => names[d]).join(',') + ' ' + t('repeat_days_suffix');
    }
    if (repeatStr.startsWith('monthly:')) {
      return t('repeat_monthly', { day: repeatStr.split(':')[1] });
    }
    return t('repeat_set');
  };

  return (
    <div 
      className="min-h-screen p-4 md:p-8 selection:bg-primary/30 transition-all duration-700"
      style={{ background: settings.bgColor }}
    >
      <div className="mx-auto max-w-2xl relative">
        {/* Header */}
        <header className="mb-6 flex flex-col md:flex-row justify-between md:items-end gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center shadow-lg transition-all duration-300",
                settings.accentColor === 'cyan' ? "bg-gradient-to-br from-cyan-500 to-teal-500 shadow-cyan-500/25" :
                settings.accentColor === 'rose' ? "bg-gradient-to-br from-rose-500 to-pink-500 shadow-rose-500/25" :
                settings.accentColor === 'amber' ? "bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-500/25" :
                "bg-gradient-to-br from-violet-500 to-purple-500 shadow-violet-500/25"
              )}>
                <AppIcon className="h-5 w-5 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">{settings.appTitle || t('app_title')}</h1>
              <p className="text-sm text-muted-foreground italic">"{quote}"</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 h-9 w-9 flex items-center justify-center rounded-xl bg-secondary/50 text-muted-foreground hover:text-foreground transition-all hover:rotate-90"
            >
              <Settings className="h-5 w-5" />
            </button>
            <div className="flex bg-secondary/50 p-1 rounded-lg">
              <button 
                onClick={() => setActiveTab("home")}
                className={cn("px-4 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5", activeTab === "home" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                <Check className="h-3 w-3" /> {t('tasks')}
              </button>
              <button 
                onClick={() => setActiveTab("stats")}
                className={cn("px-4 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5", activeTab === "stats" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                <BarChart className="h-3 w-3" /> {t('stats')}
              </button>
            </div>
          </div>
        </header>

        {activeTab === "home" ? (
          <>
            {/* Date Navigation */}
            <div className="mb-6 flex items-center justify-between bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-4 shadow-lg">
              <button 
                onClick={handlePrevDay}
                className="p-2 hover:bg-secondary rounded-xl transition-colors text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              
              <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={() => setIsCalendarOpen(true)}>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                    {todayStr}
                  </span>
                </div>
                {!isSelectedToday && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleGoToday(); }}
                    className="text-[10px] font-bold text-primary/70 hover:text-primary transition-colors uppercase tracking-wider"
                  >
                    Today
                  </button>
                )}
              </div>

              <button 
                onClick={handleNextDay}
                className="p-2 hover:bg-secondary rounded-xl transition-colors text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Progress Card */}
            <div className="mb-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-5 shadow-xl transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-sm font-medium text-muted-foreground">{t('progress')}</span>
                </div>
                <span className="text-sm font-bold text-foreground">
                  {completedCount}/{totalCount} ({Math.round(progressPercent)}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden mb-4">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex flex-col gap-3">
                
                {/* Task summary chips */}
                <div className="flex overflow-x-auto pb-1 gap-2 pt-2 border-border/50" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  <style dangerouslySetInnerHTML={{__html: `::-webkit-scrollbar { display: none; }`}} />
                  {uncompletedTodos.map(todo => (
                    <a 
                      href={`#task-${todo.id}`} 
                      key={`chip-${todo.id}`} 
                      onClick={(e) => {
                         e.preventDefault();
                         document.getElementById(`task-${todo.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                         // Flash effect
                         const el = document.getElementById(`task-${todo.id}`);
                         if(el) {
                           el.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background');
                           setTimeout(() => el.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background'), 1000);
                         }
                      }}
                      className={cn(
                        "shrink-0 text-[11px] px-3 py-1.5 rounded-full border whitespace-nowrap transition-all duration-300", 
                        todo.completed ? "border-primary/50 bg-primary/10 text-primary font-medium" : "border-border bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                    >
                      {todo.completed ? '✓ ' : ''}{todo.text || todo.title}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Add Todo Card */}
            <div className="mb-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-5 shadow-xl">
              <div className="mb-4">
                <input
                  type="text"
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTodo()}
                  placeholder={t('placeholder_new_todo')}
                  className="w-full bg-background border-2 border-border/70 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-inner"
                />
              </div>

              {/* Advanced Settings */}
              <div className="flex flex-col gap-6 mt-4 pt-4 border-t border-border/50">
                <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
                  {/* Category Selection */}
                  <div className="flex-[1.5] min-w-[180px] w-full">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2"><Tag className="h-3 w-3"/> {t('category')}</span>
                    <div className="flex gap-2">
                      {Object.keys(categoryConfig).map((cat) => {
                        const config = categoryConfig[cat];
                        const Icon = config.icon;
                        return (
                          <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={cn(
                              "flex-1 px-2.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all duration-200 border whitespace-nowrap h-[42px]",
                              selectedCategory === cat
                                ? `bg-gradient-to-r ${config.color} text-white shadow-lg border-transparent`
                                : "bg-background border-border/70 text-muted-foreground hover:text-foreground hover:border-primary/50"
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {t(config.label)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Priority Selection */}
                  <div className="flex-[1.5] min-w-[180px] w-full">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2"><Zap className="h-3 w-3"/> {t('priority')}</span>
                    <div className="flex gap-2">
                      {Object.keys(priorityConfig).map((pri) => {
                        const config = priorityConfig[pri];
                        const isSelected = selectedPriority === pri;
                        return (
                          <button
                            key={pri}
                            onClick={() => setSelectedPriority(pri)}
                            className={cn(
                              "flex-1 px-2.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all duration-300 border relative overflow-hidden h-[42px] whitespace-nowrap",
                              isSelected
                                ? `bg-gradient-to-br ${config.color} text-white border-transparent shadow-[0_0_12px_rgba(0,0,0,0.15)] ring-1 ring-white/20 scale-[1.02]`
                                : "bg-background border-border/70 text-muted-foreground/60 hover:text-foreground hover:border-border"
                            )}
                          >
                            {/* Inner dot with subtle glow when selected */}
                            <div className={cn(
                              "h-1.5 w-1.5 rounded-full transition-all duration-300 shrink-0",
                              isSelected ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" : config.dot
                            )} />
                            <span className="relative z-10">{t(config.label)}</span>
                            {isSelected && (
                              <motion.div 
                                layoutId="pri-active"
                                className="absolute inset-0 bg-white/10"
                                initial={false}
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Duration Selection */}
                  <div className="flex-[0.7] min-w-[80px] w-full">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2"><Timer className="h-3 w-3"/> {t('duration')}</span>
                    <select
                      value={selectedDuration}
                      onChange={(e) => setSelectedDuration(e.target.value)}
                      className="bg-background border border-border/70 rounded-xl px-2.5 text-[11px] font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer shadow-sm w-full h-[42px]"
                    >
                      <option value={15}>15{t('unit_min')}</option>
                      <option value={30}>30{t('unit_min')}</option>
                      <option value={60}>1{t('unit_hour')}</option>
                      <option value={120}>2{t('unit_hour')}</option>
                    </select>
                  </div>

                  {/* Repeat Selection */}
                  <div className="flex-1 min-w-[120px] w-full">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2"><Repeat className="h-3 w-3"/> {t('repeat')}</span>
                    <button
                      onClick={() => openRepeatModalFor('new')}
                      className="bg-background border border-border/70 rounded-xl px-2.5 text-[11px] font-bold flex items-center justify-center gap-1.5 hover:bg-secondary w-full transition-colors shadow-sm text-foreground h-[42px]"
                    >
                      <span className="truncate">{formatRepeatLabel(newTodoRepeat)}</span>
                    </button>
                  </div>
                </div>
                
                {/* Submit Button Moved to Bottom */}
                <button
                  onClick={handleAddTodo}
                  className="mt-2 w-full h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center gap-2 text-white font-bold shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Plus className="h-5 w-5" />
                  {t('add_button')}
                </button>
              </div>
            </div>

            {/* Todo List */}
            <div className="space-y-3 pb-8">
              {sortedTasks.length === 0 ? (
                <div className="text-center py-12">
                  <div className="h-16 w-16 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto mb-4">
                    <Check className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">
                    {t('no_tasks')}
                  </p>
                </div>
              ) : (
                sortedTasks.map((todo) => {
                  const catConfig = categoryConfig[todo.category || 'home'];
                  const priConfig = priorityConfig[todo.priority || 'medium'];
                  const Icon = catConfig.icon;
                  
                  let dateObj = new Date();
                  try {
                    if (todo.createdAt) dateObj = new Date(todo.createdAt);
                    else if (todo.date) dateObj = new Date(todo.date);
                  } catch (e) {}

                  return (
                    <div
                      id={`task-${todo.id}`}
                      key={todo.id}
                      className={cn(
                        "group relative rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-4 shadow-lg transition-all duration-300 hover:shadow-xl hover:border-border",
                        todo.completed && "opacity-60"
                      )}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* Checkbox */}
                          <button
                            onClick={() => handleToggleTaskWithConfirm(todo)}
                            className={cn(
                              "mt-0.5 h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all duration-200 shrink-0",
                              todo.completed
                                ? "bg-gradient-to-br from-cyan-500 to-teal-500 border-transparent shadow-[0_0_10px_rgba(34,211,238,0.4)]"
                                : "border-border/80 hover:border-primary bg-background shadow-inner"
                            )}
                          >
                            {todo.completed && <Check className="h-3.5 w-3.5 text-white" />}
                          </button>

                          {/* Content */}
                          <div className="flex-1 min-w-0 pb-1">
                            <p
                              className={cn(
                                "text-[15px] font-medium text-foreground transition-all break-all leading-snug",
                                todo.completed && "line-through text-muted-foreground"
                              )}
                            >
                              {todo.text || todo.title} 
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-gradient-to-r text-white whitespace-nowrap shadow-sm",
                                  catConfig.color
                                )}
                              >
                                <Icon className="h-3 w-3" />
                                {t(catConfig.label)}
                              </span>
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-background border border-border/50 rounded-md px-2 py-0.5 whitespace-nowrap shadow-sm">
                                <span className={cn("h-1.5 w-1.5 rounded-full", priConfig.dot)} />
                                {t(priConfig.label)}
                              </span>
                              {(todo.duration !== undefined) && (
                                <span className="flex items-center gap-1 text-[10px] font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-md px-2 py-0.5 whitespace-nowrap">
                                  <Timer className="h-3 w-3" />
                                  {todo.duration}{t('unit_min')}
                                </span>
                              )}
                              {todo.repeat && todo.repeat !== 'none' && (
                                <span className="flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 border border-primary/20 rounded-md px-2 py-0.5 whitespace-nowrap">
                                  <Repeat className="h-3 w-3" />
                                  {formatRepeatLabel(todo.repeat)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="flex flex-row items-center justify-end gap-2 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity mt-2 sm:mt-0">
                          
                          {/* Duration Edit Button */}
                          <div className="relative">
                            <select 
                              value={todo.duration || 30}
                              onChange={(e) => updateTask(todo.id, { duration: parseInt(e.target.value) })}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              title={t('title_duration_change')}
                            >
                              <option value={15}>15{t('unit_min')}</option>
                              <option value={30}>30{t('unit_min')}</option>
                              <option value={60}>1{t('unit_hour')}</option>
                              <option value={120}>2{t('unit_hour')}</option>
                            </select>
                            <button className="h-8 w-8 rounded-lg border border-border/70 bg-background flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-all duration-200 shadow-sm">
                              <Timer className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Repeat Edit Button */}
                          <button 
                            onClick={() => openRepeatModalFor(todo.id)}
                            title={t('title_repeat_change')}
                            className="h-8 w-8 rounded-lg border border-border/70 bg-background flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-all duration-200 shadow-sm"
                          >
                            <Repeat className="h-4 w-4" />
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => deleteTask(todo.id)}
                            className="h-8 w-8 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive hover:bg-destructive hover:text-white transition-all duration-200 shadow-sm"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
{/* Glow effect for high priority */}
                      {todo.priority === "high" && !todo.completed && (
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-rose-500/5 to-transparent pointer-events-none" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <StatisticsView tasks={tasks} toggleTask={toggleTask} />
        )}
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-card w-full max-w-md rounded-3xl border border-border/50 shadow-2xl p-6 overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  <h3 className="text-xl font-bold text-foreground">{t('title_app_custom')}</h3>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="h-8 w-8 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground">
                  <Plus className="h-5 w-5 rotate-45" />
                </button>
              </div>

               <div className="relative flex-1 overflow-hidden">
                 {/* Custom Confirmation Overlay */}
                 <AnimatePresence>
                   {confirmState && (
                     <motion.div 
                       initial={{ opacity: 0, scale: 0.95 }}
                       animate={{ opacity: 1, scale: 1 }}
                       exit={{ opacity: 0, scale: 0.95 }}
                       className="absolute inset-0 z-50 bg-card/95 backdrop-blur-sm flex items-center justify-center p-6 text-center"
                     >
                       <div className="space-y-4">
                         <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                            <Trash2 className="h-6 w-6 text-destructive" />
                         </div>
                         <div>
                            <h4 className="text-lg font-bold text-foreground">{confirmState.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1">{confirmState.message}</p>
                         </div>
                         <div className="flex gap-2 pt-2">
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setConfirmState(null);
                              }}
                              className="flex-1 py-2.5 rounded-xl bg-secondary text-foreground text-sm font-bold hover:bg-secondary/80 transition-all"
                            >
                              {t('btn_cancel')}
                            </button>
                            <button 
                              type="button"
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                try {
                                  const action = confirmState.action;
                                  const shouldGoBack = confirmState.shouldGoBack;
                                  setConfirmState(null); 
                                  await action();
                                  if (shouldGoBack) setSettingsView('main');
                                } catch (err) {
                                  console.error("Confirmation action failed:", err);
                                }
                              }}
                              className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold hover:opacity-90 transition-opacity"
                            >
                              {t('btn_confirm')}
                            </button>
                         </div>
                       </div>
                     </motion.div>
                   )}
                 </AnimatePresence>

                 <div className="max-h-[60vh] space-y-6 overflow-y-auto pr-2 pb-4 scrollbar-thin">
                 {settingsView === 'main' ? (
                   <>
                      {/* Title Setting & Language Toggle */}
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">{t('change_app_name')}</label>
                          <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                              <Type className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <input 
                                type="text"
                                value={settings.appTitle}
                                maxLength={20}
                                onChange={(e) => setSettings({...settings, appTitle: e.target.value.slice(0, 20)})}
                                className="w-full bg-secondary/50 border border-border/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder={t('placeholder_app_name')}
                              />
                            </div>
                            
                            {/* Compact Language Toggle */}
                            <div className="flex items-center bg-secondary/50 border border-border/50 rounded-xl p-1 h-[42px] shrink-0 min-w-[120px]">
                              {[
                                { code: 'ko', label: 'KO' },
                                { code: 'en', label: 'EN' },
                              ].map((lang) => {
                                const isActive = i18n.language.startsWith(lang.code);
                                return (
                                  <button
                                    key={lang.code}
                                    onClick={() => i18n.changeLanguage(lang.code)}
                                    className={cn(
                                      "flex-1 h-full rounded-lg text-[11px] font-bold transition-all duration-300 flex items-center justify-center",
                                      isActive 
                                        ? "bg-primary text-primary-foreground shadow-sm" 
                                        : "text-muted-foreground hover:text-foreground"
                                    )}
                                  >
                                    {lang.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>

                     {/* Icon & Accent Setting */}
                     <div>
                       <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">{t('app_custom')}</label>
                       <div className="space-y-4 bg-secondary/20 p-4 rounded-2xl border border-border/50">
                          <div className="grid grid-cols-5 gap-2">
                            {Object.keys(iconMap).map(iconName => {
                              const IconComp = iconMap[iconName];
                              const isSelected = settings.appIcon === iconName;
                              return (
                                <button
                                  key={iconName}
                                  onClick={() => setSettings({...settings, appIcon: iconName})}
                                  className={cn(
                                    "aspect-square rounded-xl flex items-center justify-center border transition-all",
                                    isSelected ? "bg-primary border-transparent text-primary-foreground shadow-lg" : "bg-secondary/30 border-border/50 text-muted-foreground hover:bg-secondary"
                                  )}
                                >
                                  <IconComp className="h-5 w-5" />
                                </button>
                              )
                            })}
                          </div>

                          <div className="flex gap-3">
                            {['cyan', 'violet', 'rose', 'amber'].map(color => (
                              <button
                                key={color}
                                onClick={() => setSettings({...settings, accentColor: color})}
                                className={cn(
                                  "flex-1 h-10 rounded-xl border transition-all",
                                  settings.accentColor === color ? "ring-2 ring-offset-2 ring-offset-background ring-primary border-transparent" : "border-border/50 opacity-60 hover:opacity-100",
                                  color === 'cyan' ? 'bg-cyan-500' : color === 'violet' ? 'bg-violet-500' : color === 'rose' ? 'bg-rose-500' : 'bg-amber-500'
                                )}
                              />
                            ))}
                          </div>
                       </div>
                     </div>

                     {/* Background Color Setting */}
                     <div>
                       <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">{t('theme_select')}</label>
                       <div className="grid grid-cols-2 gap-3">
                         {[
                           { name: 'OLED Black', value: 'linear-gradient(to bottom, #000000, #09090b)' },
                           { name: 'Midnight', value: 'linear-gradient(to bottom, #09090b, #18181b)' },
                           { name: 'Deep Space', value: 'linear-gradient(to bottom, #020617, #0f172a)' },
                           { name: 'Navy Blue', value: 'linear-gradient(to bottom, #050b14, #0d141d)' }
                         ].map(theme => (
                           <button
                             key={theme.name}
                             onClick={() => setSettings({...settings, bgColor: theme.value})}
                             className={cn(
                               "px-4 py-3 rounded-xl text-xs font-medium border transition-all text-left flex items-center justify-between",
                               settings.bgColor === theme.value ? "border-primary bg-primary/10 text-primary" : "border-border/50 bg-secondary/30 text-muted-foreground hover:border-border"
                             )}
                           >
                             {theme.name}
                             <div className="h-3 w-3 rounded-full border border-white/10" style={{ background: theme.value }} />
                           </button>
                         ))}
                       </div>
                     </div>

                     {/* Management Link */}
                     <div className="pt-2 border-t border-border/50">
                        <button 
                          onClick={() => setSettingsView('reset')}
                          className="w-full py-3 rounded-xl bg-secondary/50 text-foreground text-sm font-bold hover:bg-secondary transition-all flex items-center justify-center gap-2"
                        >
                          <Trash2 className="h-4 w-4 text-rose-500" /> {t('reset_data')}
                        </button>
                     </div>
                   </>
                 ) : (
                   <div className="animate-in slide-in-from-right-4 duration-300">
                      <div className="flex items-center gap-2 mb-6">
                        <button onClick={() => setSettingsView('main')} className="p-2 hover:bg-secondary rounded-lg transition-colors">
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <h4 className="font-bold">{t('reset_data')}</h4>
                      </div>

                      <div className="space-y-3">
                         {/* 1. 전체 초기화 */}
                         <button 
                           onClick={() => {
                             setConfirmState({
                               title: t('reset_all_title'),
                               message: t('reset_all_msg'),
                               action: resetAllTasks,
                               shouldGoBack: true
                             });
                           }}
                           className="w-full p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-left hover:bg-destructive/20 transition-all group"
                         >
                           <div className="flex items-center justify-between mb-1">
                             <span className="text-sm font-bold text-destructive">1. {t('reset_all_title')}</span>
                             <Trash2 className="h-4 w-4 text-destructive opacity-50 group-hover:opacity-100" />
                           </div>
                           <p className="text-[11px] text-muted-foreground">{t('reset_all_msg')}</p>
                         </button>

                         {/* 2. 미완료 초기화 */}
                         <button 
                           onClick={() => {
                             setConfirmState({
                               title: t('reset_incomplete_title'),
                               message: t('reset_incomplete_msg'),
                               action: resetAllIncompleteTasks,
                               shouldGoBack: true
                             });
                           }}
                           className="w-full p-4 rounded-2xl bg-secondary/30 border border-border/50 text-left hover:bg-secondary/50 transition-all group"
                         >
                           <div className="flex items-center justify-between mb-1">
                             <span className="text-sm font-bold text-foreground">2. {t('reset_incomplete_title')}</span>
                             <CalendarX className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100" />
                           </div>
                           <p className="text-[11px] text-muted-foreground">{t('reset_incomplete_msg')}</p>
                         </button>

                         {/* 3. 반복업무 미완료 초기화 */}
                         <button 
                           onClick={() => {
                             setConfirmState({
                               title: t('reset_repeating_title'),
                               message: t('reset_repeating_msg'),
                               action: resetAllRepeatingIncompleteTasks,
                               shouldGoBack: true
                             });
                           }}
                           className="w-full p-4 rounded-2xl bg-secondary/30 border border-border/50 text-left hover:bg-secondary/50 transition-all group"
                         >
                           <div className="flex items-center justify-between mb-1">
                             <span className="text-sm font-bold text-foreground">3. {t('reset_repeating_title')}</span>
                             <Repeat className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100" />
                           </div>
                           <p className="text-[11px] text-muted-foreground">{t('reset_repeating_msg')}</p>
                         </button>

                        <div className="pt-4 mt-2 border-t border-border/50">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">{t('active_repeating_tasks')}</label>
                          <div className="space-y-2">
                            {repeatingTaskGroups.length === 0 ? (
                              <p className="text-[11px] text-center py-4 text-muted-foreground">{t('no_active_repeating')}</p>
                            ) : (
                              repeatingTaskGroups.map(group => (
                                <div key={group.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/50">
                                  <div className="min-w-0 flex-1 mr-2">
                                    <div className="text-sm font-medium truncate">{group.text}</div>
                                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                      <Repeat className="h-3 w-3" /> {formatRepeatLabel(group.repeat)} · {t('uncompleted_count', { count: group.uncompletedCount })}
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => {
                                      setConfirmState({
                                        title: t('reset_repeating_task_title'),
                                        message: t('reset_repeating_task_msg', { text: group.text }),
                                        action: () => resetRepeatingTask(group.id)
                                      });
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-bold hover:bg-destructive hover:text-destructive-foreground transition-all"
                                  >
                                    {t('btn_reset')}
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                   </div>
                 )}
               </div>
             </div>

             <div className="flex gap-3 mt-6">
                 <button
                   onClick={handleLogout}
                   className="flex-1 py-3 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 font-bold hover:bg-destructive/20 transition-all flex items-center justify-center gap-2"
                 >
                   <LogOut className="h-4 w-4" /> {t('btn_logout')}
                 </button>
                 <button
                   onClick={() => {
                     setIsSettingsOpen(false);
                     setTimeout(() => setSettingsView('main'), 300);
                   }}
                   className="flex-[2] py-3 rounded-xl bg-primary text-primary-foreground font-bold shadow-lg hover:opacity-90 transition-opacity"
                 >
                   {t('btn_settings_done')}
                 </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Repeat Configuration Modal */}
      {repeatModalState.isOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
           <div className="bg-card w-full max-w-sm rounded-2xl border border-border/50 shadow-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-primary" />
              <h3 className="text-lg font-bold mb-4 text-foreground flex items-center gap-2">
                 <Repeat className="h-5 w-5 text-primary" /> {t('title_repeat_settings')}
              </h3>
              
              <div className="space-y-4">
                 <div>
                    <label className="text-xs text-muted-foreground mb-2 block">{t('label_repeat_pattern')}</label>
                    <select 
                       value={repeatModalState.type}
                       onChange={(e) => setRepeatModalState({...repeatModalState, type: e.target.value})}
                       className="w-full bg-secondary border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/50"
                    >
                       <option value="none">{t('option_none_once')}</option>
                       <option value="daily">{t('repeat_daily')}</option>
                       <option value="weekdays">{t('repeat_weekdays')}</option>
                       <option value="weekly">{t('repeat_weekly')}</option>
                       <option value="days">{t('option_specific_days')}</option>
                       <option value="monthly">{t('option_specific_date')}</option>
                    </select>
                 </div>

                 {repeatModalState.type === 'days' && (
                   <div className="animate-in slide-in-from-top-2">
                     <label className="text-xs text-muted-foreground mb-2 block">{t('label_select_days')}</label>
                     <div className="flex gap-1 justify-between">
                       {t('days_short', { returnObjects: true }).map((dayName, idx) => {
                         const currentDays = repeatModalState.payload ? repeatModalState.payload.split(',').map(Number) : [];
                         const isSelected = currentDays.includes(idx);
                         return (
                           <button 
                             key={idx}
                             onClick={() => {
                               let newDays = isSelected ? currentDays.filter(d => d !== idx) : [...currentDays, idx];
                               setRepeatModalState({...repeatModalState, payload: newDays.sort().join(',')});
                             }}
                             className={cn("w-10 h-10 rounded-full text-xs font-bold transition-all", isSelected ? "bg-primary text-primary-foreground shadow-md" : "bg-secondary text-muted-foreground hover:bg-border")}
                           >
                             {dayName}
                           </button>
                         )
                       })}
                     </div>
                   </div>
                 )}

                 {repeatModalState.type === 'monthly' && (
                   <div className="animate-in slide-in-from-top-2">
                     <label className="text-xs text-muted-foreground mb-2 block">{t('label_select_date')}</label>
                     <input 
                        type="number" min="1" max="31"
                        value={repeatModalState.payload || '1'}
                        onChange={(e) => setRepeatModalState({...repeatModalState, payload: e.target.value})}
                        className="w-full bg-secondary border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/50"
                     />
                   </div>
                 )}
              </div>

              <div className="flex gap-3 justify-end mt-8">
                 <button 
                   onClick={() => setRepeatModalState({ ...repeatModalState, isOpen: false })}
                   className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
                 >
                    {t('btn_cancel')}
                 </button>
                 <button 
                   onClick={saveRepeatModal}
                   className="px-6 py-2 rounded-xl text-sm font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
                 >
                    {t('btn_save')}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Complete Configuration Modal */}
      {completeModalState.isOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
           <div className="bg-card w-full max-w-sm rounded-2xl border border-border/50 shadow-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-teal-500" />
              <h3 className="text-lg font-bold mb-2 text-foreground flex items-center gap-2">
                 <Check className="h-5 w-5 text-primary" /> {t('title_completion_record')}
              </h3>
              <p className="text-sm text-muted-foreground mb-6 line-clamp-1">{completeModalState.task?.text || completeModalState.task?.title}</p>
              
              <div className="space-y-4">
                 <div>
                    <label className="text-xs text-muted-foreground mb-2 block">{t('label_actual_duration')}</label>
                    <input 
                       type="number" min="1" max="1440" step="5"
                       value={completeModalState.duration}
                       onChange={(e) => setCompleteModalState({...completeModalState, duration: e.target.value})}
                       className="w-full bg-secondary border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/50"
                    />
                 </div>
              </div>

              <div className="flex gap-3 justify-end mt-8">
                 <button 
                   onClick={() => setCompleteModalState({ isOpen: false, task: null, duration: 30 })}
                   className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
                 >
                    {t('btn_cancel')}
                 </button>
                 <button 
                   onClick={confirmCompletion}
                   className="px-6 py-2 rounded-xl text-sm font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
                 >
                    {t('btn_complete_confirm')}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Calendar Picker Modal */}
      <AnimatePresence>
        {isCalendarOpen && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card w-full max-w-sm rounded-3xl border border-border/50 shadow-2xl p-6 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary to-cyan-500" />
              
              <div className="flex items-center justify-between mb-6">
                <div />
                <button 
                  onClick={() => setIsCalendarOpen(false)}
                  className="h-8 w-8 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground transition-colors"
                >
                  <Plus className="h-5 w-5 rotate-45" />
                </button>
              </div>

              <CalendarPicker 
                selectedDate={selectedDate} 
                onSelect={(date) => {
                  setSelectedDate(startOfDay(date));
                  setIsCalendarOpen(false);
                }} 
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

// --- Custom Calendar Picker Component ---
function CalendarPicker({ selectedDate, onSelect }) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selectedDate));
  
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const prevMonth = () => setCurrentMonth(prev => subDays(startOfMonth(prev), 1));
  const nextMonth = () => setCurrentMonth(prev => addDays(endOfMonth(prev), 1));

  const { t, i18n } = useTranslation();
  const currentLocale = i18n.language === 'en' ? enUS : ko;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <span className="font-bold text-foreground">
          {format(currentMonth, i18n.language.startsWith('ko') ? 'yyyy. MM.' : 'MMMM yyyy', { locale: currentLocale })}
        </span>
        <div className="flex gap-1">
          <button onClick={prevMonth} className="p-2 hover:bg-secondary rounded-lg transition-colors"><ChevronLeft className="h-4 w-4"/></button>
          <button onClick={nextMonth} className="p-2 hover:bg-secondary rounded-lg transition-colors"><ChevronRight className="h-4 w-4"/></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {t('days_short', { returnObjects: true }).map((d, i) => (
          <div key={d} className={cn("text-center text-[10px] font-bold py-2", i === 0 ? "text-rose-500" : i === 6 ? "text-cyan-500" : "text-muted-foreground")}>
            {d}
          </div>
        ))}
        {days.map((day, idx) => {
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
          const isToday = isSameDay(day, new Date());

          return (
            <button
              key={idx}
              onClick={() => onSelect(day)}
              className={cn(
                "aspect-square rounded-xl text-xs font-medium flex flex-col items-center justify-center transition-all relative",
                !isCurrentMonth ? "text-muted-foreground/30" : "text-foreground hover:bg-secondary",
                isSelected && "bg-primary text-primary-foreground hover:bg-primary shadow-lg shadow-primary/20 scale-105 z-10",
                isToday && !isSelected && "text-primary font-bold after:content-[''] after:absolute after:bottom-1.5 after:h-1 after:w-1 after:rounded-full after:bg-primary"
              )}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- Statistics Component Isolated ---
function StatisticsView({ tasks, toggleTask }) {
  const { t, i18n } = useTranslation();
  const [timeframe, setTimeframe] = useState(14);
  const [selectedDate, setSelectedDate] = useState(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // Trigger CSS height transition after initial mount
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Compute past N days completion rate.
  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const days = [];
    // Calculate from (timeframe-1) days ago to 7 days in the future
    for (let i = timeframe - 1; i >= -7; i--) {
      const d = subDays(today, i);
      
      // Filter tasks associated with this day
      // A task belongs to a day if it was created/due on that day.
      const dayTasks = tasks.filter(t => {
         const tDate = startOfDay(new Date(t.date || t.createdAt));
         return isSameDay(tDate, d);
      });

      const total = dayTasks.length;
      const completed = dayTasks.filter(t => t.completed).length;
      const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

      days.push({
        date: d,
        tasks: dayTasks,
        total,
        completed,
        percent,
        label: new Intl.DateTimeFormat(i18n.language, { month: 'numeric', day: 'numeric' }).format(d),
        dayNum: format(d, 'd'),
        dayName: new Intl.DateTimeFormat(i18n.language, { weekday: 'short' }).format(d)
      });
    }
    return days;
  }, [tasks, timeframe]);

  const { globalCompletion, totalValidTasks, totalCompleted } = useMemo(() => {
     const today = startOfDay(new Date());
     const relevantTasks = tasks.filter(t => {
         if (t.completed) return true;
         const tDate = startOfDay(new Date(t.date || t.createdAt));
         return tDate <= today;
     });
     
     if(relevantTasks.length === 0) return { globalCompletion: 0, totalValidTasks: 0, totalCompleted: 0 };
     const completed = relevantTasks.filter(t => t.completed).length;
     return {
        globalCompletion: Math.round((completed / relevantTasks.length) * 100),
        totalValidTasks: relevantTasks.length,
        totalCompleted: completed
     };
  }, [tasks]);

  return (
    <div className="animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-5 shadow-xl">
           <h3 className="text-sm text-muted-foreground mb-1">{t('stats_total_progress')}</h3>
           <div className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-primary">
             {globalCompletion}%
           </div>
           <p className="text-xs text-muted-foreground mt-2">{t('total_tasks_prefix', { count: totalValidTasks, defaultValue: `Total ${totalValidTasks} recorded tasks` })}</p>
        </div>
        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-5 shadow-xl flex items-center justify-between">
           <div>
             <h3 className="text-sm text-muted-foreground mb-1">{t('stats_total_completed')}</h3>
             <div className="text-4xl font-bold text-foreground">
               {totalCompleted} <span className="text-2xl text-muted-foreground font-normal">{t('stats_count_unit')}</span>
             </div>
           </div>
           <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="h-8 w-8 text-primary" />
           </div>
        </div>
      </div>

      <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-5 shadow-xl">
         <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
           <h3 className="font-bold text-foreground flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary" /> {t('stats_record_title')}
           </h3>
           <select 
             value={timeframe} 
             onChange={(e) => setTimeframe(Number(e.target.value))}
             className="bg-secondary/50 border border-border/50 text-foreground text-xs rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-primary/50 outline-none cursor-pointer"
           >
             <option value={7}>{t('stats_7days')}</option>
             <option value={14}>{t('stats_14days')}</option>
             <option value={30}>{t('stats_30days')}</option>
           </select>
         </div>
         
         {/* Grid View similar to GitHub contributions */}
         <div className="grid grid-cols-7 gap-2 mb-4">
           {t('days_short', { returnObjects: true }).map(d => (
             <div key={d} className="text-center text-[10px] text-muted-foreground font-medium">{d}</div>
           ))}
           {/* Pad empty cells for the aligning days */}
           {Array.from({ length: stats[0].date.getDay() }).map((_, i) => (
             <div key={`empty-${i}`} className="aspect-square rounded-lg bg-transparent" />
           ))}
           {stats.map((day, i) => {
                return (
                <div 
                  key={i} 
                  className="group relative cursor-pointer"
                  onClick={() => setSelectedDate(day.date)}
                >
                  <div className="aspect-[4/5] rounded-xl bg-secondary/30 border border-border/50 relative overflow-hidden transition-all hover:scale-105 flex flex-col justify-end">
                    {/* Vertical Progress Bar Fill */}
                    <div 
                      className={cn("absolute bottom-0 left-0 w-full transition-all duration-[1500ms] ease-out", 
                        isSameDay(day.date, new Date()) && "wave-fill",
                        day.percent === 100 ? "bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)]" :
                        day.percent >= 50 ? "bg-cyan-500/80 shadow-[0_0_10px_rgba(8,145,178,0.3)]" :
                        day.percent > 0 ? "bg-cyan-800/60" : "bg-transparent h-0 border-none"
                      )}
                      style={{ height: mounted ? `${day.percent}%` : '0%' }}
                    />
                    {/* Text overlays */}
                    <div className="absolute inset-x-0 bottom-1 flex items-center justify-center pointer-events-none">
                       <span className="text-[10px] text-muted-foreground font-medium z-10">{day.dayNum}</span>
                    </div>
                  </div>
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] px-3 py-2 rounded-xl text-xs bg-foreground text-background opacity-0 -translate-y-2 group-hover:translate-y-0 group-hover:opacity-100 transition-all pointer-events-none z-10 flex flex-col gap-1 shadow-xl">
                    <div className="font-bold border-b border-background/20 pb-1 mb-1 flex justify-between gap-4">
                       <span>{day.label}</span>
                       <span className="text-cyan-400">{day.percent}%</span>
                    </div>
                    {day.tasks.filter(t => t.completed).length > 0 ? (
                      day.tasks.filter(t => t.completed).slice(0, 3).map(t => (
                        <div key={t.id} className="truncate">✓ {t.text || t.title}</div>
                      ))
                    ) : (
                      <div className="text-background/60 italic">{t('stats_no_records')}</div>
                    )}
                    {day.tasks.filter(t => t.completed).length > 3 && (
                      <div className="text-background/50 text-[10px] text-center mt-1">{t('stats_more_items', { count: day.tasks.filter(t => t.completed).length - 3 })}</div>
                    )}
                  </div>
                </div>
              );
           })}
         </div>

         {/* Detailed View for Selected Date */}
         {selectedDate && (
           <div className="mt-8 pt-6 border-t border-border/50 animate-in slide-in-from-bottom-4">
             <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-foreground">
                  {new Intl.DateTimeFormat(i18n.language, { month: 'numeric', day: 'numeric', weekday: 'long' }).format(selectedDate)} {t('stats_scoreboard')}
                </h4>
                <button onClick={() => setSelectedDate(null)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 bg-secondary rounded-md">{t('stats_close')}</button>
             </div>
             <div className="space-y-3">
               {(() => {
                  const targetDay = stats.find(s => isSameDay(s.date, selectedDate));
                  if (!targetDay || targetDay.tasks.filter(t => t.completed).length === 0) {
                     return <div className="text-center py-8 text-muted-foreground bg-secondary/30 rounded-xl">{t('stats_no_records_day')}</div>;
                  }
                  
                  return targetDay.tasks.filter(t => t.completed).map(todo => {
                     // Parse completion time
                     let timeStr = "";
                     if(todo.completedAt) {
                        try {
                           const completeDate = new Date(todo.completedAt);
                           const scheduledDate = new Date(todo.date || todo.createdAt);
                           
                           // If completed on a different day than scheduled, show original date
                           if (!isSameDay(startOfDay(completeDate), startOfDay(scheduledDate))) {
                               const diffDays = Math.round((startOfDay(completeDate) - startOfDay(scheduledDate)) / (1000 * 60 * 60 * 24));
                               const statusText = diffDays < 0 ? t('stats_early', { days: Math.abs(diffDays) }) : t('stats_late', { days: diffDays });
                               timeStr = `(${statusText}) `;
                           }
                           
                           timeStr += new Intl.DateTimeFormat(i18n.language, { hour: 'numeric', minute: 'numeric' }).format(completeDate);
                        } catch(e){}
                     }

                     return (
                        <div key={todo.id} className="group flex items-start gap-4 p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-secondary/50 transition-colors">
                           <button
                             onClick={() => toggleTask(todo.id)}
                             title={t('return_to_tasks')}
                             className="mt-0.5 h-6 w-6 rounded border border-border flex items-center justify-center transition-all bg-primary/20 hover:bg-destructive/20 hover:border-destructive text-primary hover:text-destructive shrink-0"
                           >
                             <Check className="h-4 w-4 group-hover:hidden" />
                             <Trash2 className="h-4 w-4 hidden group-hover:block" />
                           </button>
                           <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground leading-snug">
                                {(() => {
                                  const text = todo.text || todo.title || '';
                                  const urlRegex = /(https?:\/\/[^\s]+)/g;
                                  const parts = text.split(urlRegex);
                                  return parts.map((part, i) => 
                                    urlRegex.test(part) ? (
                                      <a 
                                        key={i} 
                                        href={part} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="text-primary hover:underline break-all"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {part}
                                      </a>
                                    ) : part
                                  );
                                })()}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[10px] text-muted-foreground">
                                 <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded-md text-white whitespace-nowrap bg-gradient-to-r", categoryConfig[todo.category || 'home'].color)}>
                                   {React.createElement(categoryConfig[todo.category || 'home'].icon, { className: "h-3 w-3" })}
                                   {t(categoryConfig[todo.category || 'home'].label)}
                                 </span>
                                 {timeStr && <span className="flex items-center gap-1 bg-secondary border border-border/50 px-2 py-0.5 rounded-md whitespace-nowrap"><Clock className="h-3 w-3" /> {t('stats_completed_at', { time: timeStr })}</span>}
                                 {todo.duration && <span className="flex items-center gap-1 bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-md whitespace-nowrap"><Timer className="h-3 w-3" /> {t('stats_estimated', { min: todo.duration })}</span>}
                              </div>
                           </div>
                        </div>
                     );
                  });
               })()}
             </div>
           </div>
         )}
      </div>
    </div>
  );
}

export default SmartTodo;
