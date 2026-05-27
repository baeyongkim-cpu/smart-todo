import React, { useState, useEffect } from 'react'
import SmartTodo from './components/SmartTodo'
import Auth from './components/Auth'
import { supabase } from './utils/db'

import { useRegisterSW } from 'virtual:pwa-register/react'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  // PWA 자동 업데이트 설정
  useRegisterSW({
    onRegistered(r) {
      r && setInterval(() => {
        r.update()
      }, 60 * 60 * 1000) // 1시간마다 업데이트 체크
    },
    onNeedRefresh() {
      // 새 버전 발견 시 즉시 새로고침
      window.location.reload()
    }
  })

  useEffect(() => {
    // Theme initialization
    const saved = localStorage.getItem('smart-todo-settings');
    let theme = 'dark';
    if (saved) {
      try {
        theme = JSON.parse(saved).theme || 'dark';
      } catch (e) {}
    }
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="text-muted-foreground text-sm font-medium animate-pulse">Initializing Smart Tasks...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative transition-colors duration-300">
      {session ? (
        <SmartTodo user={session.user} />
      ) : (
        <Auth onLogin={(user) => setSession({ user })} />
      )}
      
      {/* 버전 표시 (우측 하단 아주 작게) */}
      <div className="fixed bottom-1 right-2 text-[10px] text-muted-foreground/50 pointer-events-none select-none z-[99999]">
        v1.1.3
      </div>
    </div>
  )
}

export default App;
