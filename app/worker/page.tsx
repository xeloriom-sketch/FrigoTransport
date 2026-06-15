'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Truck, Clock, MapPin, CheckCircle, LogOut, Snowflake } from 'lucide-react'

type Screen = 'loading' | 'active' | 'done' | 'no_truck'

export default function WorkerPage() {
  const router = useRouter()
  const supabase = createClient()

  const [screen, setScreen] = useState<Screen>('loading')
  const [profile, setProfile] = useState<{ full_name: string; id: string } | null>(null)
  const [assignment, setAssignment] = useState<any>(null)
  const [elapsed, setElapsed] = useState('')
  const [gpsActive, setGpsActive] = useState(false)
  const [stopping, setStopping] = useState(false)

  const watchIdRef = useRef<number | null>(null)
  const lastSentRef = useRef<number>(0)

  useEffect(() => {
    load()
    return () => stopGPS()
  }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login/'); return }

    let { data: prof } = await supabase.from('profiles').select('id, full_name, role').eq('id', user.id).maybeSingle()
    if (!prof) {
      await supabase.from('profiles').upsert({ id: user.id, full_name: user.email?.split('@')[0] ?? 'Ouvrier', role: 'worker' }, { onConflict: 'id' })
      const r = await supabase.from('profiles').select('id, full_name, role').eq('id', user.id).maybeSingle()
      prof = r.data
    }
    if (prof?.role === 'admin') { router.push('/admin/'); return }
    setProfile({ full_name: prof?.full_name ?? '', id: user.id })

    const { data: assign } = await supabase
      .from('assignments')
      .select('id, truck_id, started_at, truck:trucks(name, plate_number)')
      .eq('worker_id', user.id)
      .eq('is_active', true)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (assign) {
      setAssignment(assign)
      setScreen('active')
      startGPS(user.id, assign)
    } else {
      setScreen('no_truck')
    }
  }

  function startGPS(userId: string, assign: any) {
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

  function stopGPS() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setGpsActive(false)
  }

  async function handleCamionRange() {
    if (!assignment || stopping) return
    setStopping(true)

    // 1. Stopper le GPS immédiatement
    stopGPS()

    // 2. Fermer l'affectation en base
    await supabase.from('assignments')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('id', assignment.id)

    setScreen('done')
    setStopping(false)
  }

  async function handleLogout() {
    stopGPS()
    await supabase.auth.signOut()
    router.push('/login/')
  }

  // Chronomètre
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

  const firstName = profile?.full_name?.split(' ')[0] ?? ''
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'

  // ── LOADING ──────────────────────────────────────────────────────────────────
  if (screen === 'loading') return (
    <div className="min-h-screen bg-bg-main flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // ── FIN DE SERVICE CONFIRMÉ ───────────────────────────────────────────────────
  if (screen === 'done') return (
    <div className="min-h-screen bg-bg-main flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-80 h-80 bg-accent/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="relative">
        <div className="w-20 h-20 bg-accent/10 border border-accent/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-accent" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Camion rangé !</h1>
        <p className="text-txt-muted text-sm mb-1">Bonne route, <span className="text-white font-medium">{firstName}</span>.</p>
        <p className="text-txt-muted text-xs">La géolocalisation est désactivée.</p>

        <div className="mt-10 flex flex-col gap-3 w-full max-w-xs mx-auto">
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 py-3 bg-bg-card border border-border-thin text-txt-muted text-sm rounded-xl hover:text-white hover:border-neutral-600 transition"
          >
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  )

  // ── PAS DE CAMION ─────────────────────────────────────────────────────────────
  if (screen === 'no_truck') return (
    <div className="min-h-screen bg-bg-main flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-bg-card border border-border-thin rounded-3xl flex items-center justify-center mx-auto mb-5">
        <Truck className="w-8 h-8 text-txt-muted" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">{greeting}, {firstName}</h1>
      <p className="text-txt-muted text-sm mb-1">Aucun camion assigné.</p>
      <p className="text-txt-muted text-xs">Scannez le QR code dans votre camion pour commencer.</p>
      <button
        onClick={handleLogout}
        className="mt-10 flex items-center gap-2 text-txt-muted text-xs hover:text-white transition"
      >
        <LogOut className="w-3.5 h-3.5" /> Se déconnecter
      </button>
    </div>
  )

  // ── EN SERVICE ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-bg-main flex flex-col relative overflow-hidden" style={{ letterSpacing: '-0.01em' }}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-accent/4 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative flex-1 flex flex-col p-6 pt-12 max-w-sm mx-auto w-full">

        {/* En-tête */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-1">
            <Snowflake className="w-3.5 h-3.5 text-txt-muted" />
            <span className="text-txt-muted text-xs">FrigoTransport</span>
          </div>
          <p className="text-txt-muted text-sm font-medium uppercase tracking-[0.15em] mb-1">{greeting}</p>
          <h1 className="text-4xl font-bold text-white tracking-tight">{firstName}</h1>
        </div>

        {/* Carte camion */}
        <div className="bg-bg-card border border-border-thin rounded-3xl p-5 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 bg-bg-input border border-border-thin rounded-2xl flex items-center justify-center">
              <Truck className="w-5 h-5 text-txt-muted" />
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold text-sm leading-tight">{assignment?.truck?.name}</p>
              <p className="text-txt-muted text-[11px] font-mono mt-0.5">{assignment?.truck?.plate_number}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-accent text-[11px] font-medium">Actif</span>
            </div>
          </div>

          <div className="h-px bg-border-thin mb-4" />

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-bg-input border border-border-thin rounded-2xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Clock className="w-3 h-3 text-txt-muted" />
                <span className="text-txt-muted text-[10px] uppercase tracking-wider">En service</span>
              </div>
              <p className="text-white font-bold text-xl">{elapsed}</p>
            </div>
            <div className="bg-bg-input border border-border-thin rounded-2xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <MapPin className="w-3 h-3 text-txt-muted" />
                <span className="text-txt-muted text-[10px] uppercase tracking-wider">GPS</span>
              </div>
              <p className={`font-bold text-xl ${gpsActive ? 'text-accent' : 'text-txt-muted'}`}>
                {gpsActive ? 'Actif' : '...'}
              </p>
            </div>
          </div>
        </div>

        {/* Info prise de poste */}
        <div className="bg-bg-card border border-border-thin rounded-2xl px-4 py-3 flex items-center justify-between mb-8">
          <span className="text-txt-muted text-xs">Prise de poste</span>
          <span className="text-white text-xs font-medium">
            {assignment && new Date(assignment.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Bouton principal */}
        <button
          onClick={handleCamionRange}
          disabled={stopping}
          className="w-full py-4 bg-accent text-black font-bold text-base rounded-2xl hover:bg-[#d2eb57] active:scale-[0.99] transition duration-150 disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg"
          style={{ boxShadow: '0 0 30px rgba(225,249,112,0.15)' }}
        >
          {stopping
            ? <><div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />Arrêt en cours...</>
            : <><CheckCircle className="w-5 h-5" />Camion rangé</>
          }
        </button>

        {/* Déconnexion discrète */}
        <button
          onClick={handleLogout}
          className="mt-5 w-full flex items-center justify-center gap-2 py-2 text-txt-muted text-xs hover:text-white transition rounded-xl"
        >
          <LogOut className="w-3.5 h-3.5" /> Se déconnecter
        </button>

      </div>
    </div>
  )
}
