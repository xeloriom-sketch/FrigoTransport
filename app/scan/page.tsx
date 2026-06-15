'use client'

import { Suspense, useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

function ScanContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('t')
  const [state, setState] = useState<'loading' | 'tracking' | 'error'>('loading')
  const [message, setMessage] = useState('Vérification en cours...')
  const watchIdRef = useRef<number | null>(null)
  const lastSentRef = useRef<number>(0)
  const supabase = createClient()

  useEffect(() => {
    if (!token) { setState('error'); setMessage('QR code invalide'); return }
    checkIn()
    return () => { if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current) }
  }, [token])

  async function checkIn() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login/?next=' + encodeURIComponent('/scan/?t=' + token))
      return
    }

    const { data: truck } = await supabase.from('trucks').select('id, name').eq('qr_token', token).single()
    if (!truck) { setState('error'); setMessage('QR code non reconnu.'); return }

    await supabase.from('assignments')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('worker_id', user.id).eq('is_active', true)

    const { data: assignment } = await supabase.from('assignments')
      .insert({ truck_id: truck.id, worker_id: user.id })
      .select('id').single()

    if (!assignment) { setState('error'); setMessage('Erreur de connexion. Réessayez.'); return }

    setState('tracking')
    setMessage(`Connecté — ${truck.name}`)

    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          const now = Date.now()
          if (now - lastSentRef.current < 30_000) return
          lastSentRef.current = now
          await supabase.from('locations').insert({
            assignment_id: assignment.id,
            truck_id: truck.id,
            worker_id: user.id,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? null,
            speed: pos.coords.speed ?? null,
            heading: pos.coords.heading ?? null,
          })
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
      )
    }

    setTimeout(() => router.push('/worker/'), 1500)
  }

  return (
    <div className="text-center text-white p-8">
      <Loader2 className={`w-10 h-10 mx-auto mb-4 ${state !== 'error' ? 'animate-spin text-sky-400' : 'text-red-400'}`} />
      <p className="text-lg font-medium text-slate-200">{message}</p>
      {state === 'error' && (
        <button onClick={() => router.push('/')} className="mt-6 px-4 py-2 bg-sky-500 rounded-lg text-sm font-medium">Retour</button>
      )}
    </div>
  )
}

export default function ScanPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <Suspense fallback={<Loader2 className="w-10 h-10 animate-spin text-sky-400" />}>
        <ScanContent />
      </Suspense>
    </div>
  )
}
