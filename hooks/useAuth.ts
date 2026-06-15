'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

export function useAuth(requiredRole?: 'admin' | 'worker') {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/FrigoTransport/login/?next=' + encodeURIComponent(window.location.pathname + window.location.search))
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (requiredRole === 'admin' && profile?.role !== 'admin') {
        router.push('/FrigoTransport/worker/')
        return
      }

      setUser(user)
      setProfile(profile)
      setLoading(false)
    }

    load()
  }, [])

  return { user, profile, loading }
}
