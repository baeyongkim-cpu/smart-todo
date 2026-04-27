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
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#00E5FF]/20 border-t-[#00E5FF] rounded-full animate-spin"></div>
          <p className="text-white/40 text-sm font-medium animate-pulse">Initializing Smart Tasks...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white relative">
      {session ? (
        <SmartTodo user={session.user} />
      ) : (
        <Auth onLogin={(user) => setSession({ user })} />
      )}
      
      {/* 버전 표시 (우측 하단 아주 작게) */}
      <div className="fixed bottom-1 right-2 text-[10px] text-white/30 pointer-events-none select-none z-[99999]">
        v1.1.3
      </div>
    </div>
  )
}

export default App;
