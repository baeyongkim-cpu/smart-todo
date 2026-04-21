import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TaskItem from './TaskItem';
import { ChevronRight } from 'lucide-react';

const TaskList = ({ groupedTasks, onToggle, onDelete }) => {
  const { overdue, today } = groupedTasks;

  return (
    <div className="px-6 pb-32">
      {/* Overdue Section */}
      <AnimatePresence>
        {overdue.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-bold text-warning">미룬 일 (Overdue)</h3>
              <span className="text-[12px] font-medium text-text-subtle flex items-center">
                {overdue.length} tasks <ChevronRight size={14} />
              </span>
            </div>
            <div className="space-y-3">
              {overdue.map(task => (
                <TaskItem 
                  key={task.id} 
                  task={task} 
                  onToggle={onToggle} 
                  onDelete={onDelete} 
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Today Section Header matching reference layout */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-bold text-white">오늘 할 일 (Today)</h3>
        <span className="text-[12px] font-medium text-text-subtle flex items-center hover:text-white transition-colors cursor-pointer">
          See all <ChevronRight size={14} className="ml-0.5" />
        </span>
      </div>
      
      {today.length === 0 ? (
        <div className="premium-card p-8 flex flex-col items-center justify-center text-center opacity-70 border-dashed">
          <p className="text-white font-bold text-lg mb-1">하루가 비어있네요.</p>
          <p className="text-xs text-text-muted">가볍게 시작할 수 있는 작은 목표를 추가해보세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {today.map(task => (
              <TaskItem 
                key={task.id} 
                task={task} 
                onToggle={onToggle} 
                onDelete={onDelete} 
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default TaskList;
