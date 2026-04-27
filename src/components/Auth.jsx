import React, { useState } from 'react';
import { supabase } from '../utils/db';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, UserPlus, LogIn, Globe, Zap, CircleAlert } from 'lucide-react';

const Auth = ({ onLogin }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        if (data.user) {
          setError('Verification email sent! Please check your inbox.');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (data.user) onLogin(data.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        }
      });
      if (error) throw error;
    } catch (err) {
      console.error('Google Login Error:', err);
      setError(`구글 로그인 실패: ${err.message || 'Supabase 설정을 확인해주세요.'}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0A0A0A]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-[#161616] p-8 rounded-3xl border border-white/5 shadow-2xl"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#00E5FF]/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#00E5FF]/20">
            <Zap className="w-8 h-8 text-[#00E5FF]" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Smart Tasks</h2>
          <p className="text-gray-400">
            {isSignUp ? '새로운 계정을 만들어보세요' : '다시 오신 것을 환영합니다'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400 ml-1">이메일 (ID)</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="email"
                required
                maxLength={200}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-[#00E5FF]/50 transition-all"
                placeholder="email@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400 ml-1">비밀번호 (6자 이상)</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-[#00E5FF]/50 transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-3 rounded-xl border border-red-400/20"
              >
                <CircleAlert className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00E5FF] text-black font-bold py-4 rounded-2xl mt-4 hover:bg-[#00B4CC] transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                {isSignUp ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                {isSignUp ? '회원가입' : '로그인'}
              </>
            )}
          </button>
        </form>

        <div className="mt-6">
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#161616] px-2 text-gray-500">또는</span></div>
          </div>

          <button 
            onClick={handleGoogleLogin}
            className="w-full bg-white text-black font-semibold py-3 rounded-2xl hover:bg-gray-100 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            <Globe className="w-5 h-5" />
            Google 계정으로 계속하기
          </button>
        </div>

        <p className="mt-8 text-center text-sm text-gray-500">
          {isSignUp ? '이미 계정이 있으신가요?' : '아직 계정이 없으신가요?'}
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="ml-2 text-[#00E5FF] font-semibold hover:underline"
          >
            {isSignUp ? '로그인하기' : '회원가입하기'}
          </button>
        </p>
      </motion.div>
    </div>
  );
};

export default Auth;
