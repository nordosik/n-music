'use client'

import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../lib/usePlayer'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = usePlayer((state) => state.setUser)

  useEffect(() => {
    // 1. Подтягиваем активную сессию при первой загрузке
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          username: session.user.user_metadata?.username || session.user.email?.split('@')[0],
          avatar_url: session.user.user_metadata?.avatar_url,
        })
      }
    })

    // 2. Слушаем мгновенный вход / регистрацию / выход
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          username: session.user.user_metadata?.username || session.user.email?.split('@')[0],
          avatar_url: session.user.user_metadata?.avatar_url,
        })
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [setUser])

  return <>{children}</>
}