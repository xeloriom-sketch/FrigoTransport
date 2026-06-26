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
        // Retirer le basePath (/FrigoTransport) du pathname avant de l'encoder
        // car router.push() re-préfixe automatiquement avec le basePath
        const rawPath = window.location.pathname
        const cleanPath = rawPath.replace(/^\/FrigoTransport/, '') || '/'
        router.push('/login/?next=' + encodeURIComponent(cleanPath + window.location.search))
        return
      }

      let { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      // Profil manquant → le créer (fallback si trigger pas déclenché)
      if (!profile) {
        await supabase.from('profiles').upsert({
          id: user.id,
          full_name: user.email?.split('@')[0] ?? 'Ouvrier',
          role: 'worker',
        }, { onConflict: 'id' })
        const res = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
        profile = res.data
      }

      if (requiredRole === 'admin' && profile?.role !== 'admin') {
        router.push('/worker/')
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
