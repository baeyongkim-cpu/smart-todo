import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Clock, Bell, ChevronDown } from 'lucide-react';

const AddTaskModal = ({ isOpen, onClose, onAdd }) => {
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('30');
  const [alarmTime, setAlarmTime] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    let alarmISO = null;
    if (alarmTime) {
      const [hrs, mins] = alarmTime.split(':');
      const d = new Date();
      d.setHours(parseInt(hrs), parseInt(mins), 0, 0);
      alarmISO = d.toISOString();
    }

    onAdd({
      title: title.trim(),
      duration: parseInt(duration) || 30,
      alarmTime: alarmISO
    });

    setTitle('');
    setDuration('30');
    setAlarmTime('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-[8px] z-50 flex items-end justify-center"
          />
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300, mass: 0.5 }}
            className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-gradient-to-b from-[#2A2F4C] to-[#151724] rounded-t-[36px] p-6 z-50 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] border-t border-white/10"
          >
            {/* Handle bar for bottom sheet visual cue */}
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 shrink-0" />

            <div className="flex justify-between items-center mb-6">
              <h2 className="text-[20px] font-bold tracking-tight text-white">무엇을 계획하시나요?</h2>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={20} className="text-text-muted" strokeWidth={2.5} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <input
                  ref={inputRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 스쿼트 100개 완료하기"
                  className="w-full bg-[#ffffff0a] border border-[#ffffff10] rounded-[16px] px-5 py-4 text-white placeholder-text-muted/60 focus:bg-[#ffffff15] focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all text-lg font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative group">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-text-muted mb-2 tracking-wide">
                    <Clock size={12} strokeWidth={2.5} /> 집중 시간 (분)
                  </label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full bg-[#ffffff0a] border border-[#ffffff0a] rounded-[14px] px-4 py-3.5 text-white outline-none focus:border-text-subtle transition-colors pr-10"
                  />
                  <span className="absolute right-4 bottom-3.5 text-text-subtle font-medium text-sm pointer-events-none">m</span>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-text-muted mb-2 tracking-wide">
                    <Bell size={12} strokeWidth={2.5} /> 알람 (선택)
                  </label>
                  <div className="relative">
                    <input
                      type="time"
                      value={alarmTime}
                      onChange={(e) => setAlarmTime(e.target.value)}
                      className="w-full bg-[#ffffff0a] border border-[#ffffff0a] rounded-[14px] px-4 py-3.5 text-white outline-none focus:border-text-subtle transition-colors [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-50"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={!title.trim()}
                className="w-full relative overflow-hidden bg-gradient-active text-white disabled:opacity-50 font-bold text-[17px] py-4 rounded-[16px] flex items-center justify-center mt-4 transition-transform active:scale-[0.97]"
              >
                추가하기
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AddTaskModal;
