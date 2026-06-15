'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Snowflake } from 'lucide-react'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    async function handleCallback() {
      // Supabase met le token dans le hash de l'URL (#access_token=...)
      // getSession() l'échange automatiquement et établit la session
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        // Attendre un peu et réessayer (hash pas encore traité)
        await new Promise(r => setTimeout(r, 1500))
        const { data: { session: s2 } } = await supabase.auth.getSession()
        if (!s2) { router.push('/login/'); return }
      }

      const user = session?.user ?? (await supabase.auth.getUser()).data.user
      if (!user) { router.push('/login/'); return }

      // S'assurer que le profil existe
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile) {
        await supabase.from('profiles').upsert({
          id: user.id,
          full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Ouvrier',
          role: user.user_metadata?.role ?? 'worker',
        }, { onConflict: 'id' })
      }

      const role = profile?.role ?? user.user_metadata?.role ?? 'worker'
      router.push(role === 'admin' ? '/admin/' : '/worker/')
    }

    handleCallback()
  }, [])

  return (
    <div className="min-h-screen bg-bg-main flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 bg-accent/10 border border-accent/20 rounded-2xl flex items-center justify-center">
        <Snowflake className="w-5 h-5 text-accent" />
      </div>
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      <p className="text-txt-muted text-sm">Connexion en cours...</p>
    </div>
  )
}
