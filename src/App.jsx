import React, { useState, useEffect } from 'react'
import SmartTodo from './components/SmartTodo'
import Auth from './components/Auth'
import { supabase } from './utils/db'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

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
    <div className="min-h-screen bg-black text-white">
      {session ? (
        <SmartTodo user={session.user} />
      ) : (
        <Auth onLogin={(user) => setSession({ user })} />
      )}
    </div>
  )
}

export default App;
