'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Truck, Clock, LogOut } from 'lucide-react'

export default function WorkerPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<{ full_name: string } | null>(null)
  const [assignment, setAssignment] = useState<any>(null)
  const [elapsed, setElapsed] = useState('')
  const [loading, setLoading] = useState(true)
  const watchIdRef = useRef<number | null>(null)
  const lastSentRef = useRef<number>(0)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login/'); return }

      const { data: prof } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
      if (prof?.role === 'admin') { router.push('/admin/'); return }
      setProfile(prof)

      const { data: assign } = await supabase
        .from('assignments')
        .select('id, started_at, truck:trucks(name, plate_number)')
        .eq('worker_id', user.id)
        .eq('is_active', true)
        .order('started_at', { ascending: false })
        .limit(1)
        .single()

      setAssignment(assign)
      setLoading(false)

      if (assign) startTracking(user.id, assign)
    }
    load()
    return () => { if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current) }
  }, [])

  function startTracking(userId: string, assign: any) {
    if (!('geolocation' in navigator)) return
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now()
        if (now - lastSentRef.current < 30_000) return
        lastSentRef.current = now
        await supabase.from('locations').insert({
          assignment_id: assign.id,
          truck_id: assign.truck_id,
          worker_id: userId,
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

  async function handleLogout() {
    if (assignment) {
      await supabase.from('assignments').update({ is_active: false, ended_at: new Date().toISOString() }).eq('id', assignment.id)
    }
    await supabase.auth.signOut()
    router.push('/login/')
  }

  if (loading) return <div className="min-h-screen bg-slate-900" />

  const firstName = profile?.full_name?.split(' ')[0] ?? ''

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl" />
      </div>
      <div className="relative w-full max-w-xs space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 bg-sky-500/20 border border-sky-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Truck className="w-7 h-7 text-sky-400" />
          </div>
          <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">Bonne journée</p>
          <h1 className="text-3xl font-bold text-white mt-1">{firstName}</h1>
        </div>

        {assignment ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Camion</span>
              <span className="text-white font-semibold">{assignment.truck?.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Immatriculation</span>
              <span className="text-white font-mono text-sm">{assignment.truck?.plate_number}</span>
            </div>
            <div className="h-px bg-white/10" />
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Clock className="w-4 h-4" />
              <span>En service depuis <span className="text-sky-400 font-medium">{elapsed}</span></span>
            </div>
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
