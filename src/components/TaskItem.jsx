import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Bell, Trash2, Check } from 'lucide-react';
import { format, isAfter, parseISO } from 'date-fns';

const TaskItem = ({ task, onToggle, onDelete }) => {
  const [isAlarmActive, setIsAlarmActive] = useState(false);

  useEffect(() => {
    let checkAlarm = setInterval(() => {
      if (task.alarmTime && !task.completed && !isAlarmActive) {
        const alarm = parseISO(task.alarmTime);
        if (isAfter(new Date(), alarm)) {
          setIsAlarmActive(true);
          if (Notification.permission === 'granted') {
            new Notification(`FocusFlow: ${task.title}`, {
              body: '목표 시간이 되었습니다!',
            });
          }
        }
      }
    }, 1000);
    return () => clearInterval(checkAlarm);
  }, [task, isAlarmActive]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileTap={{ scale: 0.98 }}
      className={`premium-card p-4 flex items-center gap-4 transition-all duration-300 ${
        task.completed ? 'opacity-50' : ''
      }`}
    >
      {/* Icon Area */}
      <div className={`icon-circle shrink-0 ${task.completed ? 'icon-bg-active' : 'icon-bg-inactive'}`}>
        {!task.completed ? (
          <Clock size={18} />
        ) : (
          <Check size={18} strokeWidth={3} />
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <span className="text-[10px] text-text-muted font-bold tracking-wider mb-0.5 uppercase">
          {task.duration} min focus
        </span>
        <h3 className={`text-[15px] font-bold truncate ${task.completed ? 'line-through text-text-subtle' : 'text-white'}`}>
          {task.title}
        </h3>
      </div>

      {/* Right Controls Area: Status/Alarm + Delete */}
      <div className="flex flex-col items-end justify-between h-full gap-2 shrink-0">
        {task.alarmTime ? (
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
            isAlarmActive ? 'bg-warning/20 text-warning animate-pulse' : 'bg-white/5 text-text-muted'
          }`}>
            <Bell size={10} className="inline mr-1" />
            {format(parseISO(task.alarmTime), 'HH:mm')}
          </span>
        ) : (
          <div className="h-[20px]"></div>
        )}

        <div className="flex items-center gap-2">
          <button 
            onClick={() => onDelete(task.id)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-text-subtle hover:text-danger transition-colors"
          >
            <Trash2 size={14} />
          </button>
          
          {/* Custom Toggle Switch replicating the device toggle */}
          <button
            onClick={() => onToggle(task.id)}
            className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${
              task.completed ? 'bg-accent-blue' : 'bg-black/30'
            }`}
          >
            <motion.div 
              layout
              className={`w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] shadow-sm`}
              initial={false}
              animate={{ 
                left: task.completed ? 'calc(100% - 17px)' : '3px'
              }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default TaskItem;
