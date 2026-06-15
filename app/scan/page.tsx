'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

type State = 'loading' | 'checking-in' | 'tracking' | 'error'

export default function ScanPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('t')

  const [state, setState] = useState<State>('loading')
  const [message, setMessage] = useState('Vérification en cours...')
  const [truckName, setTruckName] = useState('')
  const assignmentIdRef = useRef<string | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const lastSentRef = useRef<number>(0)

  const supabase = createClient()

  useEffect(() => {
    if (!token) {
      setState('error')
      setMessage('QR code invalide')
      return
    }
    checkIn()
  }, [token])

  async function checkIn() {
    setState('loading')
    setMessage('Vérification en cours...')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push(`/login?next=/scan?t=${token}`)
      return
    }

    // Trouver le camion par son token QR
    const { data: truck, error: truckError } = await supabase
      .from('trucks')
      .select('id, name')
      .eq('qr_token', token)
      .single()

    if (truckError || !truck) {
      setState('error')
      setMessage('QR code non reconnu. Contactez votre responsable.')
      return
    }

    setTruckName(truck.name)
    setState('checking-in')
    setMessage('Connexion au camion...')

    // Fermer les affectations actives précédentes
    await supabase
      .from('assignments')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('worker_id', user.id)
      .eq('is_active', true)

    // Créer nouvelle affectation
    const { data: assignment, error: assignError } = await supabase
      .from('assignments')
      .insert({ truck_id: truck.id, worker_id: user.id })
      .select('id')
      .single()

    if (assignError || !assignment) {
      setState('error')
      setMessage('Erreur lors de la connexion. Réessayez.')
      return
    }

    assignmentIdRef.current = assignment.id
    setState('tracking')
    setMessage(`Connecté — ${truck.name}`)

    startTracking(truck.id, user.id, assignment.id)
  }

  function startTracking(truckId: string, workerId: string, assignmentId: string) {
    if (!('geolocation' in navigator)) return

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now()
        // Envoyer au maximum toutes les 30 secondes
        if (now - lastSentRef.current < 30_000) return
        lastSentRef.current = now

        await fetch('/api/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignment_id: assignmentId,
            truck_id: truckId,
            worker_id: workerId,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed,
            heading: pos.coords.heading,
          }),
        })
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    )
  }

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  // Rediriger vers la page worker après check-in réussi
  useEffect(() => {
    if (state === 'tracking') {
      setTimeout(() => router.push('/worker'), 1500)
    }
  }, [state])

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center text-white p-8">
        <Loader2 className={`w-10 h-10 mx-auto mb-4 ${state !== 'error' ? 'animate-spin text-sky-400' : 'text-red-400'}`} />
        <p className="text-lg font-medium text-slate-200">{message}</p>
        {state === 'error' && (
          <button
            onClick={() => router.push('/')}
            className="mt-6 px-4 py-2 bg-sky-500 rounded-lg text-sm font-medium"
          >
            Retour
          </button>
        )}
      </div>
    </div>
  )
}
