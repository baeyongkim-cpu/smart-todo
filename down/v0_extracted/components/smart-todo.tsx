"use client";

import { useState } from "react";
import { Plus, Check, Trash2, Clock, Zap, Home, Calendar, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  category: "home" | "work" | "personal";
  priority: "low" | "medium" | "high";
  createdAt: Date;
}

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
  const [todos, setTodos] = useState<Todo[]>([
    {
      id: "1",
      text: "거실 조명 자동화 설정하기",
      completed: false,
      category: "home",
      priority: "high",
      createdAt: new Date(),
    },
    {
      id: "2",
      text: "프로젝트 미팅 자료 준비",
      completed: false,
      category: "work",
      priority: "medium",
      createdAt: new Date(),
    },
    {
      id: "3",
      text: "운동 루틴 계획 세우기",
      completed: true,
      category: "personal",
      priority: "low",
      createdAt: new Date(),
    },
  ]);

  const [newTodo, setNewTodo] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Todo["category"]>("home");
  const [selectedPriority, setSelectedPriority] = useState<Todo["priority"]>("medium");
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");

  const addTodo = () => {
    if (!newTodo.trim()) return;
    const todo: Todo = {
      id: Date.now().toString(),
      text: newTodo,
      completed: false,
      category: selectedCategory,
      priority: selectedPriority,
      createdAt: new Date(),
    };
    setTodos([todo, ...todos]);
    setNewTodo("");
  };

  const toggleTodo = (id: string) => {
    setTodos(
      todos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter((todo) => todo.id !== id));
  };

  const filteredTodos = todos.filter((todo) => {
    if (filter === "active") return !todo.completed;
    if (filter === "completed") return todo.completed;
    return true;
  });

  const completedCount = todos.filter((t) => t.completed).length;
  const totalCount = todos.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
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
        </header>

        {/* Progress Card */}
        <div className="mb-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">오늘의 진행률</span>
            </div>
            <span className="text-sm font-medium text-foreground">
              {completedCount}/{totalCount}
            </span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-4 flex gap-2">
            {(["all", "active", "completed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                  filter === f
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                {f === "all" ? "전체" : f === "active" ? "진행중" : "완료"}
              </button>
            ))}
          </div>
        </div>

        {/* Add Todo Card */}
        <div className="mb-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-5 shadow-xl">
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTodo()}
              placeholder="새로운 할 일을 입력하세요..."
              className="flex-1 bg-secondary/50 border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            />
            <button
              onClick={addTodo}
              className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <Plus className="h-5 w-5 text-white" />
            </button>
          </div>

          {/* Category & Priority Selector */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[140px]">
              <span className="text-xs text-muted-foreground mb-2 block">카테고리</span>
              <div className="flex gap-2">
                {(Object.keys(categoryConfig) as Todo["category"][]).map((cat) => {
                  const config = categoryConfig[cat];
                  const Icon = config.icon;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={cn(
                        "flex-1 px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all duration-200",
                        selectedCategory === cat
                          ? `bg-gradient-to-r ${config.color} text-white shadow-lg`
                          : "bg-secondary/50 text-muted-foreground hover:text-foreground"
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
                {(Object.keys(priorityConfig) as Todo["priority"][]).map((pri) => {
                  const config = priorityConfig[pri];
                  return (
                    <button
                      key={pri}
                      onClick={() => setSelectedPriority(pri)}
                      className={cn(
                        "flex-1 px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all duration-200",
                        selectedPriority === pri
                          ? "bg-foreground text-background"
                          : "bg-secondary/50 text-muted-foreground hover:text-foreground"
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
        </div>

        {/* Todo List */}
        <div className="space-y-3">
          {filteredTodos.length === 0 ? (
            <div className="text-center py-12">
              <div className="h-16 w-16 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">
                {filter === "completed" ? "완료된 할 일이 없습니다" : "새로운 할 일을 추가해보세요"}
              </p>
            </div>
          ) : (
            filteredTodos.map((todo) => {
              const catConfig = categoryConfig[todo.category];
              const priConfig = priorityConfig[todo.priority];
              const Icon = catConfig.icon;

              return (
                <div
                  key={todo.id}
                  className={cn(
                    "group relative rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-4 shadow-lg transition-all duration-300 hover:shadow-xl hover:border-border",
                    todo.completed && "opacity-60"
                  )}
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleTodo(todo.id)}
                      className={cn(
                        "mt-0.5 h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all duration-200",
                        todo.completed
                          ? "bg-gradient-to-br from-cyan-500 to-teal-500 border-transparent"
                          : "border-border hover:border-primary"
                      )}
                    >
                      {todo.completed && <Check className="h-3.5 w-3.5 text-white" />}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium text-foreground transition-all",
                          todo.completed && "line-through text-muted-foreground"
                        )}
                      >
                        {todo.text}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-gradient-to-r text-white",
                            catConfig.color
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          {catConfig.label}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className={cn("h-1.5 w-1.5 rounded-full", priConfig.dot)} />
                          {priConfig.label}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {todo.createdAt.toLocaleDateString("ko-KR", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={() => deleteTodo(todo.id)}
                      className="opacity-0 group-hover:opacity-100 h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive hover:text-white transition-all duration-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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

        {/* Stats Footer */}
        <footer className="mt-8 pt-6 border-t border-border/50">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "전체", value: totalCount, icon: Zap },
              { label: "진행중", value: totalCount - completedCount, icon: Clock },
              { label: "완료", value: completedCount, icon: Check },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl bg-secondary/30 backdrop-blur-sm p-4 text-center"
              >
                <stat.icon className="h-5 w-5 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}
