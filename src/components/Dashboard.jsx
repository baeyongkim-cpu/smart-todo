import React from 'react';
import { motion } from 'framer-motion';
import { Grip, User, Target } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const Dashboard = ({ progress, tomorrowCount }) => {
  const todayDate = format(new Date(), 'M월 d일', { locale: ko });
  
  // Calculations for the 270-degree arc (matching the right image)
  // We'll use a viewBox of 100x100
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  // A 270 degree arc is 75% of a full circle. (270 / 360 = 0.75)
  const arcLength = circumference * 0.75;
  // Gap is the remaining 25% (offset by rotating the SVG)
  const arcGap = circumference * 0.25;
  
  // Progress along the 270 degree arc
  const progressOffset = arcLength - (progress / 100) * arcLength;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="px-6 pt-10 pb-4"
    >
      {/* Top Bar */}
      <div className="flex justify-between items-center mb-10 text-white">
        <button className="p-2 -ml-2 text-text-muted hover:text-white transition-colors">
          <Grip size={24} strokeWidth={2} />
        </button>
        <div className="w-9 h-9 rounded-full overflow-hidden border border-white/20">
          <div className="w-full h-full bg-gradient-to-tr from-accent-cyan to-accent-blue flex items-center justify-center">
            <User size={18} className="text-white" />
          </div>
        </div>
      </div>

      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-[28px] font-bold text-white tracking-tight mb-1">
          좋은 하루입니다 👋
        </h1>
        <p className="text-[13px] text-text-muted font-medium">
          {todayDate}, 힘차게 시작해볼까요?
        </p>
      </div>

      {/* Progress Arc Card (Modeled after the Air Conditioner UI) */}
      <div className="premium-card relative overflow-hidden flex flex-col items-center justify-center py-10">
        
        {/* Arc SVG */}
        <div className="relative w-[220px] h-[220px] flex items-center justify-center">
          <svg width="220" height="220" viewBox="0 0 100 100" className="transform rotate-135">
            {/* Background Arc */}
            <circle
              cx="50" cy="50" r={radius}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="4"
              strokeLinecap="round"
              fill="transparent"
              strokeDasharray={`${arcLength} ${arcGap}`}
              strokeDashoffset="0"
            />
            
            {/* Foreground Progress Arc */}
            <motion.circle
              cx="50" cy="50" r={radius}
              stroke="url(#progressGradient)"
              strokeWidth="4"
              strokeLinecap="round"
              fill="transparent"
              strokeDasharray={`${arcLength} ${circumference}`}
              initial={{ strokeDashoffset: arcLength }}
              animate={{ strokeDashoffset: progressOffset }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
            
            {/* Knob (Circle at the end of progress) calculation requires complex trig in SVG, 
                so we use a CSS rotation wrapper approach or just omit for exactness. 
                Instead, we add a subtle glow. */}
            <defs>
              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A27BFF" />
                <stop offset="100%" stopColor="#3DD1F2" />
              </linearGradient>
            </defs>
          </svg>

          {/* Center Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
            <span className="text-[44px] font-bold text-white tracking-tighter leading-none mb-1">
              {progress}<span className="text-lg text-text-muted ml-0.5">%</span>
            </span>
            <span className="text-[11px] text-text-muted uppercase tracking-widest font-semibold">
              Today's Progress
            </span>
          </div>

          {/* Arc Labels (16° ... 32° in the image, we do 0% ... 100%) */}
          <div className="absolute bottom-6 left-0 right-0 flex justify-between px-6 text-[10px] text-text-subtle font-bold">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Current State / Mode Status */}
        <div className="mt-2 text-center z-10 text-white">
          <span className="text-[10px] text-text-muted uppercase tracking-widest font-bold block mb-1">
            Status
          </span>
          <span className="text-sm font-bold tracking-widest">
            {progress === 100 ? 'ALL CLEAR' : 'IN PROGRESS'}
          </span>
        </div>
      </div>

    </motion.div>
  );
};

export default Dashboard;
