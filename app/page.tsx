'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login/'); return }
      supabase.from('profiles').select('role').eq('id', user.id).single().then(({ data }) => {
        router.push(data?.role === 'admin' ? '/admin/' : '/worker/')
      })
    })
  }, [])

  return null
}
