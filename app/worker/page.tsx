'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Truck, Clock, LogOut, Wifi, MapPin } from 'lucide-react'

export default function WorkerPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<{ full_name: string } | null>(null)
  const [assignment, setAssignment] = useState<any>(null)
  const [elapsed, setElapsed] = useState('')
  const [loading, setLoading] = useState(true)
  const [gpsActive, setGpsActive] = useState(false)
  const watchIdRef = useRef<number | null>(null)
  const lastSentRef = useRef<number>(0)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login/'); return }

      // Profil
      let { data: prof } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle()
      if (!prof) {
        await supabase.from('profiles').upsert({ id: user.id, full_name: user.email?.split('@')[0] ?? 'Ouvrier', role: 'worker' }, { onConflict: 'id' })
        const r = await supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle()
        prof = r.data
      }
      if (prof?.role === 'admin') { router.push('/admin/'); return }
      setProfile(prof)

      // Affectation active — inclure truck_id pour le GPS
      const { data: assign } = await supabase
        .from('assignments')
        .select('id, truck_id, started_at, truck:trucks(name, plate_number)')
        .eq('worker_id', user.id)
        .eq('is_active', true)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()

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
        setGpsActive(true)
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
      setElapsed(`${h}h${m.toString().padStart(2, '0')}`)
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

  const firstName = profile?.full_name?.split(' ')[0] ?? ''
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col relative overflow-hidden">
      {/* Fond décoratif */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-sky-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-indigo-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative flex-1 flex flex-col p-6 pt-14 max-w-sm mx-auto w-full">
        {/* En-tête */}
        <div className="mb-10">
          <p className="text-sky-400 text-sm font-medium uppercase tracking-[0.2em] mb-1">{greeting}</p>
          <h1 className="text-4xl font-bold text-white">{firstName}</h1>
        </div>

        {/* Carte statut camion */}
        {assignment ? (
          <div className="flex-1 flex flex-col gap-4">
            {/* Camion principal */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 bg-sky-500/20 border border-sky-500/30 rounded-2xl flex items-center justify-center">
                  <Truck className="w-6 h-6 text-sky-400" />
                </div>
                <div>
                  <p className="text-white font-bold text-lg leading-tight">{assignment.truck?.name}</p>
                  <p className="text-slate-500 text-xs font-mono">{assignment.truck?.plate_number}</p>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 text-xs font-medium">Actif</span>
                </div>
              </div>

              <div className="h-px bg-white/10 mb-5" />

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-slate-500 text-xs">En service</span>
                  </div>
                  <p className="text-white font-bold text-xl">{elapsed}</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-slate-500 text-xs">GPS</span>
                  </div>
                  <p className={`font-bold text-xl ${gpsActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {gpsActive ? 'Actif' : 'Attente...'}
                  </p>
                </div>
              </div>
            </div>

            {/* Info heure début */}
            <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4 flex items-center gap-3">
              <Wifi className="w-4 h-4 text-sky-400 shrink-0" />
              <p className="text-slate-400 text-sm">
                Prise de poste à <span className="text-white font-medium">
                  {new Date(assignment.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
            <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center mb-6">
              <Truck className="w-10 h-10 text-slate-600" />
            </div>
            <p className="text-white font-semibold text-lg mb-2">Aucun camion assigné</p>
            <p className="text-slate-500 text-sm">Scannez le QR code dans votre camion pour commencer</p>
          </div>
        )}

        {/* Bouton déconnexion */}
        <button
          onClick={handleLogout}
          className="mt-8 w-full flex items-center justify-center gap-2 py-3 text-slate-600 hover:text-slate-400 text-sm transition rounded-2xl hover:bg-white/5 border border-transparent hover:border-white/10"
        >
          <LogOut className="w-4 h-4" />
          Fin de service
        </button>
      </div>
    </div>
  )
}
