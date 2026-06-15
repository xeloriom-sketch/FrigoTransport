'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Truck, Clock, LogOut } from 'lucide-react'

interface Props {
  userId: string
  fullName: string
  assignment: {
    id: string
    started_at: string
    truck: { name: string; plate_number: string }
  } | null
}

export default function WorkerClient({ userId, fullName, assignment }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const watchIdRef = useRef<number | null>(null)
  const lastSentRef = useRef<number>(0)
  const [elapsed, setElapsed] = useState('')

  const firstName = fullName.split(' ')[0]

  // Chronomètre depuis le check-in
  useEffect(() => {
    if (!assignment) return
    const start = new Date(assignment.started_at).getTime()
    const tick = () => {
      const diff = Date.now() - start
      const h = Math.floor(diff / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      setElapsed(`${h}h ${m.toString().padStart(2, '0')}min`)
    }
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [assignment])

  // Géolocalisation discrète continue
  useEffect(() => {
    if (!assignment || !('geolocation' in navigator)) return

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now()
        if (now - lastSentRef.current < 30_000) return
        lastSentRef.current = now

        await fetch('/api/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignment_id: assignment.id,
            truck_id: undefined,
            worker_id: userId,
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

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [assignment])

  async function handleLogout() {
    if (assignment) {
      await fetch('/api/assignments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignment.id }),
      })
    }
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
      {/* Fond décoratif */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-xs space-y-6">
        {/* En-tête */}
        <div className="text-center">
          <div className="w-14 h-14 bg-sky-500/20 border border-sky-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Truck className="w-7 h-7 text-sky-400" />
          </div>
          <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">Bonne journée</p>
          <h1 className="text-3xl font-bold text-white mt-1">{firstName}</h1>
        </div>

        {/* Info camion */}
        {assignment ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Camion</span>
              <span className="text-white font-semibold">{assignment.truck.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Immatriculation</span>
              <span className="text-white font-mono text-sm">{assignment.truck.plate_number}</span>
            </div>
            <div className="h-px bg-white/10" />
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Clock className="w-4 h-4" />
              <span>En service depuis <span className="text-sky-400 font-medium">{elapsed}</span></span>
            </div>
            {/* Indicateur actif — discret */}
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-xs">Connecté</span>
            </div>
          </div>
        ) : (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 text-center">
            <p className="text-amber-300 text-sm">Aucun camion assigné.</p>
            <p className="text-slate-400 text-xs mt-1">Scannez le QR code de votre camion.</p>
          </div>
        )}

        {/* Déconnexion */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-slate-500 hover:text-slate-300 text-sm transition rounded-xl hover:bg-white/5"
        >
          <LogOut className="w-4 h-4" />
          Fin de service
        </button>
      </div>
    </div>
  )
}
