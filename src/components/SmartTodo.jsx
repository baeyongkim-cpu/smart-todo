import React, { useState, useMemo } from "react";
import { Plus, Check, Trash2, Clock, Zap, Home, Calendar as CalendarIcon, Star, Repeat, Timer, BarChart } from "lucide-react";
import { cn } from "../lib/utils";
import { useTasks } from "../hooks/useTasks";
import { startOfDay, addDays, subDays, isSameDay } from "date-fns";

const categoryConfig = {
  home: { icon: Home, label: "홈", color: "from-cyan-500 to-teal-500" },
  work: { icon: Zap, label: "업무", color: "from-violet-500 to-purple-500" },
  personal: { icon: Star, label: "개인", color: "from-amber-500 to-orange-500" },
};

const priorityConfig = {
  low: { label: "낮음", dot: "bg-emerald-500" },
  medium: { label: "보통", dot: "bg-amber-500" },
  high: { label: "높음", dot: "bg-rose-500" },
};

export function SmartTodo() {
  const { tasks, loading, addTask, updateTask, toggleTask, deleteTask } = useTasks();

  const [activeTab, setActiveTab] = useState("home"); // 'home' | 'stats'

  const [newTodo, setNewTodo] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("home");
  const [selectedPriority, setSelectedPriority] = useState("medium");
  const [selectedDuration, setSelectedDuration] = useState(30);
  
  const [repeatModalState, setRepeatModalState] = useState({ isOpen: false, targetId: null, type: 'none', payload: '' });
  const [newTodoRepeat, setNewTodoRepeat] = useState("none"); // Default for new UI

  const [completeModalState, setCompleteModalState] = useState({ isOpen: false, task: null, duration: 30 });

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div></div>;
  }

  const handleAddTodo = () => {
    if (!newTodo.trim()) return;
    addTask({
      text: newTodo,
      category: selectedCategory,
      priority: selectedPriority,
      duration: parseInt(selectedDuration),
      repeat: newTodoRepeat,
    });
    setNewTodo("");
    setSelectedDuration(30);
    setNewTodoRepeat("none");
  };

  const today = startOfDay(new Date());
  
  // Only show uncompleted tasks that are scheduled for today or earlier.
  // This prevents future spawned instances of repeating tasks from immediately showing up!
  const uncompletedTodos = tasks.filter((todo) => {
    if (todo.completed) return false;
    const taskDate = startOfDay(new Date(todo.date || todo.createdAt));
    return taskDate <= today;
  });

  const todayTasks = tasks.filter(t => {
    if (t.completed && t.completedAt) {
      return startOfDay(new Date(t.completedAt)).getTime() === today.getTime();
    }
    const tDate = startOfDay(new Date(t.date || t.createdAt));
    return tDate <= today;
  });

  const completedCount = todayTasks.filter((t) => t.completed).length;
  const totalCount = todayTasks.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const todayStr = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long' }).format(new Date());

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
      updateTask(task.id, { duration: parseInt(duration) });
      toggleTask(task.id);
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
    if (!repeatStr || repeatStr === 'none') return '반복 안함';
    if (repeatStr === 'daily') return '매일';
    if (repeatStr === 'weekdays') return '평일';
    if (repeatStr === 'weekly') return '매주';
    if (repeatStr.startsWith('days:')) {
      const days = repeatStr.split(':')[1].split(',').map(Number);
      const names = ['일','월','화','수','목','금','토'];
      return days.map(d => names[d]).join(',') + ' 반복';
    }
    if (repeatStr.startsWith('monthly:')) {
      return `매월 ${repeatStr.split(':')[1]}일`;
    }
    return '반복 설정됨';
  };

  return (
    <div className="min-h-screen p-4 md:p-8 bg-background selection:bg-primary/30">
      <div className="mx-auto max-w-2xl relative">
        {/* Header */}
        <header className="mb-6 flex flex-col md:flex-row justify-between md:items-end gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-lg shadow-cyan-500/25">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Smart Tasks</h1>
              <p className="text-sm text-muted-foreground">스마트한 하루를 시작하세요</p>
            </div>
          </div>
          
          <div className="flex bg-secondary/50 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab("home")}
              className={cn("px-4 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5", activeTab === "home" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <Check className="h-3 w-3" /> 작업
            </button>
            <button 
              onClick={() => setActiveTab("stats")}
              className={cn("px-4 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5", activeTab === "stats" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <BarChart className="h-3 w-3" /> 결과 통계
            </button>
          </div>
        </header>

        {activeTab === "home" ? (
          <>
            {/* Progress Card */}
            <div className="mb-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-5 shadow-xl transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-muted-foreground">{todayStr} 진행률</span>
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
              <div className="flex gap-3 mb-4">
                <input
                  type="text"
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTodo()}
                  placeholder="새로운 할 일을 입력하세요..."
                  className="flex-1 bg-background border-2 border-border/70 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-inner"
                />
                <button
                  onClick={handleAddTodo}
                  className="h-12 w-12 shrink-0 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  <Plus className="h-5 w-5 text-white" />
                </button>
              </div>

              {/* Advanced Settings */}
              <div className="flex flex-col gap-4 mt-4 pt-4 border-t border-border/50">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 min-w-[140px]">
                    <span className="text-xs text-muted-foreground mb-2 block">카테고리</span>
                    <div className="flex gap-2">
                      {Object.keys(categoryConfig).map((cat) => {
                        const config = categoryConfig[cat];
                        const Icon = config.icon;
                        return (
                          <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={cn(
                              "flex-1 px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all duration-200 border",
                              selectedCategory === cat
                                ? `bg-gradient-to-r ${config.color} text-white shadow-lg border-transparent`
                                : "bg-background border-border/70 text-muted-foreground hover:text-foreground hover:border-primary/50"
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {config.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <span className="text-xs text-muted-foreground mb-2 block">우선순위</span>
                    <div className="flex gap-2">
                      {Object.keys(priorityConfig).map((pri) => {
                        const config = priorityConfig[pri];
                        return (
                          <button
                            key={pri}
                            onClick={() => setSelectedPriority(pri)}
                            className={cn(
                              "flex-1 px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all duration-200 border",
                              selectedPriority === pri
                                ? "bg-foreground text-background border-transparent"
                                : "bg-background border-border/70 text-muted-foreground hover:text-foreground hover:border-primary/50"
                            )}
                          >
                            <span className={cn("h-2 w-2 rounded-full", config.dot)} />
                            {config.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 min-w-[140px]">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2"><Timer className="h-3 w-3"/> 소요시간</span>
                    <select
                      value={selectedDuration}
                      onChange={(e) => setSelectedDuration(e.target.value)}
                      className="bg-background border border-border/70 rounded-xl px-3 py-2 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer shadow-sm w-full"
                    >
                      <option value={15}>15분</option>
                      <option value={30}>30분</option>
                      <option value={60}>1시간</option>
                      <option value={120}>2시간</option>
                    </select>
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2"><Repeat className="h-3 w-3"/> 반복 규칙</span>
                    <button
                      onClick={() => openRepeatModalFor('new')}
                      className="bg-background border border-border/70 rounded-xl px-3 py-2 text-xs font-medium flex items-center justify-center gap-2 hover:bg-secondary w-full transition-colors shadow-sm text-foreground"
                    >
                      {formatRepeatLabel(newTodoRepeat)}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Todo List */}
            <div className="space-y-3 pb-8">
              {uncompletedTodos.length === 0 ? (
                <div className="text-center py-12">
                  <div className="h-16 w-16 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto mb-4">
                    <Check className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">
                    예정된 할 일이 없습니다. 휴식을 취하세요!
                  </p>
                </div>
              ) : (
                uncompletedTodos.map((todo) => {
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
                                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-gradient-to-r text-white shrink-0 shadow-sm",
                                  catConfig.color
                                )}
                              >
                                <Icon className="h-3 w-3" />
                                {catConfig.label}
                              </span>
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-background border border-border/50 rounded-md px-2 py-0.5 shrink-0 shadow-sm">
                                <span className={cn("h-1.5 w-1.5 rounded-full", priConfig.dot)} />
                                {priConfig.label}
                              </span>
                              {(todo.duration !== undefined) && (
                                <span className="flex items-center gap-1 text-[10px] font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-md px-2 py-0.5 shrink-0">
                                  <Timer className="h-3 w-3" />
                                  {todo.duration}분
                                </span>
                              )}
                              {todo.repeat && todo.repeat !== 'none' && (
                                <span className="flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 border border-primary/20 rounded-md px-2 py-0.5 shrink-0">
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
                              title="소요시간 설정 변경"
                            >
                              <option value={15}>15분</option>
                              <option value={30}>30분</option>
                              <option value={60}>1시간</option>
                              <option value={120}>2시간</option>
                            </select>
                            <button className="h-8 w-8 rounded-lg border border-border/70 bg-background flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-all duration-200 shadow-sm">
                              <Timer className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Repeat Edit Button */}
                          <button 
                            onClick={() => openRepeatModalFor(todo.id)}
                            title="반복 설정 변경"
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

      {/* Repeat Configuration Modal */}
      {repeatModalState.isOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
           <div className="bg-card w-full max-w-sm rounded-2xl border border-border/50 shadow-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-primary" />
              <h3 className="text-lg font-bold mb-4 text-foreground flex items-center gap-2">
                 <Repeat className="h-5 w-5 text-primary" /> 반복 규칙 설정
              </h3>
              
              <div className="space-y-4">
                 <div>
                    <label className="text-xs text-muted-foreground mb-2 block">반복 패턴</label>
                    <select 
                       value={repeatModalState.type}
                       onChange={(e) => setRepeatModalState({...repeatModalState, type: e.target.value})}
                       className="w-full bg-secondary border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/50"
                    >
                       <option value="none">반복 안함 (1회성)</option>
                       <option value="daily">매일</option>
                       <option value="weekdays">평일 (월~금)</option>
                       <option value="weekly">매주</option>
                       <option value="days">특정 요일 지정</option>
                       <option value="monthly">특정 날짜 지정 (매월)</option>
                    </select>
                 </div>

                 {repeatModalState.type === 'days' && (
                   <div className="animate-in slide-in-from-top-2">
                     <label className="text-xs text-muted-foreground mb-2 block">반복할 요일 선택</label>
                     <div className="flex gap-1 justify-between">
                       {['일','월','화','수','목','금','토'].map((dayName, idx) => {
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
                     <label className="text-xs text-muted-foreground mb-2 block">반복할 날짜 (매월 N일)</label>
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
                    취소
                 </button>
                 <button 
                   onClick={saveRepeatModal}
                   className="px-6 py-2 rounded-xl text-sm font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
                 >
                    저장하기
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
                 <Check className="h-5 w-5 text-primary" /> 업무 완료 기록
              </h3>
              <p className="text-sm text-muted-foreground mb-6 line-clamp-1">{completeModalState.task?.text || completeModalState.task?.title}</p>
              
              <div className="space-y-4">
                 <div>
                    <label className="text-xs text-muted-foreground mb-2 block">실제 소요시간 (분)</label>
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
                    취소
                 </button>
                 <button 
                   onClick={confirmCompletion}
                   className="px-6 py-2 rounded-xl text-sm font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
                 >
                    완료 확정
                 </button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
}

// --- Statistics Component Isolated ---
function StatisticsView({ tasks, toggleTask }) {
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
    for (let i = timeframe - 1; i >= 0; i--) {
      const d = subDays(today, i);
      
      // Filter tasks associated with this day
      // A task belongs to a day if it was created/due on that day.
      const dayTasks = tasks.filter(t => {
         let tDate;
         if (t.completed && t.completedAt) tDate = startOfDay(new Date(t.completedAt));
         else if (t.date) tDate = startOfDay(new Date(t.date));
         else if (t.createdAt) tDate = startOfDay(new Date(t.createdAt));
         else return false;
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
        label: new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' }).format(d),
        dayName: new Intl.DateTimeFormat('ko-KR', { weekday: 'short' }).format(d)
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
           <h3 className="text-sm text-muted-foreground mb-1">전체 누적 달성률</h3>
           <div className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-primary">
             {globalCompletion}%
           </div>
           <p className="text-xs text-muted-foreground mt-2">총 {totalValidTasks}개의 기록된 할 일 중</p>
        </div>
        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-5 shadow-xl flex items-center justify-between">
           <div>
             <h3 className="text-sm text-muted-foreground mb-1">총 완료 건수</h3>
             <div className="text-4xl font-bold text-foreground">
               {totalCompleted} <span className="text-2xl text-muted-foreground font-normal">건</span>
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
              <CalendarIcon className="h-4 w-4 text-primary" /> 달성 기록
           </h3>
           <select 
             value={timeframe} 
             onChange={(e) => setTimeframe(Number(e.target.value))}
             className="bg-secondary/50 border border-border/50 text-foreground text-xs rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-primary/50 outline-none cursor-pointer"
           >
             <option value={7}>최근 7일</option>
             <option value={14}>최근 14일</option>
             <option value={30}>최근 한 달 (30일)</option>
           </select>
         </div>
         
         {/* Grid View similar to GitHub contributions */}
         <div className="grid grid-cols-7 gap-2 mb-4">
           {['일','월','화','수','목','금','토'].map(d => (
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
                       <span className="text-[10px] text-muted-foreground font-medium z-10">{day.label.split('.')[1]}</span>
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
                      <div className="text-background/60 italic">완료 내역 없음</div>
                    )}
                    {day.tasks.filter(t => t.completed).length > 3 && (
                      <div className="text-background/50 text-[10px] text-center mt-1">외 {day.tasks.filter(t => t.completed).length - 3}건... (클릭하여 보기)</div>
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
                  {new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'long' }).format(selectedDate)} 스코어보드
                </h4>
                <button onClick={() => setSelectedDate(null)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 bg-secondary rounded-md">닫기</button>
             </div>
             <div className="space-y-3">
               {(() => {
                  const targetDay = stats.find(s => isSameDay(s.date, selectedDate));
                  if (!targetDay || targetDay.tasks.filter(t => t.completed).length === 0) {
                     return <div className="text-center py-8 text-muted-foreground bg-secondary/30 rounded-xl">해당 일자의 완료 기록이 없습니다.</div>;
                  }
                  
                  return targetDay.tasks.filter(t => t.completed).map(todo => {
                     // Parse completion time
                     let timeStr = "";
                     if(todo.completedAt) {
                        try {
                           timeStr = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: 'numeric' }).format(new Date(todo.completedAt));
                        } catch(e){}
                     }

                     return (
                        <div key={todo.id} className="group flex items-start gap-4 p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-secondary/50 transition-colors">
                           <button
                             onClick={() => toggleTask(todo.id)}
                             title="작업 탭으로 되돌리기"
                             className="mt-0.5 h-6 w-6 rounded border border-border flex items-center justify-center transition-all bg-primary/20 hover:bg-destructive/20 hover:border-destructive text-primary hover:text-destructive shrink-0"
                           >
                             <Check className="h-4 w-4 group-hover:hidden" />
                             <Trash2 className="h-4 w-4 hidden group-hover:block" />
                           </button>
                           <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground leading-snug">{todo.text || todo.title}</p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[10px] text-muted-foreground">
                                 {timeStr && <span className="flex items-center gap-1 bg-secondary border border-border/50 px-2 py-0.5 rounded-md"><Clock className="h-3 w-3" /> {timeStr} 완료</span>}
                                 {todo.duration && <span className="flex items-center gap-1 bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-md"><Timer className="h-3 w-3" /> {todo.duration}분 예상 소요</span>}
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
