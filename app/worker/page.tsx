'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Truck, Clock, MapPin, CheckCircle, LogOut, Snowflake, Camera, QrCode, X, AlertCircle } from 'lucide-react'
import InstallPWA from '@/components/InstallPWA'

type Screen = 'loading' | 'active' | 'done' | 'no_truck' | 'scanning'

export default function WorkerPage() {
  const router = useRouter()
  const supabase = createClient()

  const [screen, setScreen]       = useState<Screen>('loading')
  const [profile, setProfile]     = useState<{ full_name: string; id: string } | null>(null)
  const [assignment, setAssignment] = useState<any>(null)
  const [elapsed, setElapsed]     = useState('')
  const [gpsActive, setGpsActive] = useState(false)
  const [stopping, setStopping]   = useState(false)
  const [scanError, setScanError] = useState('')
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'found'>('idle')

  const watchIdRef    = useRef<number | null>(null)
  const lastSentRef   = useRef<number>(0)
  const videoRef      = useRef<HTMLVideoElement>(null)
  const streamRef     = useRef<MediaStream | null>(null)
  const rafRef        = useRef<number | null>(null)
  const userIdRef     = useRef<string>('')

  useEffect(() => {
    load()
    return () => { stopGPS(); stopCamera() }
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

    userIdRef.current = user.id
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

  // ── GPS ─────────────────────────────────────────────────────────────────────

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

  // ── SCANNER QR ───────────────────────────────────────────────────────────────

  function stopCamera() {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
  }

  async function openScanner() {
    setScanError('')
    setScanStatus('idle')
    setScreen('scanning')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setScanStatus('scanning')
        startDetection()
      }
    } catch (err: any) {
      const msg = err.name === 'NotAllowedError'
        ? "Accès caméra refusé. Autorisez la caméra dans les réglages du navigateur."
        : err.name === 'NotFoundError'
        ? "Aucune caméra trouvée sur cet appareil."
        : "Impossible d'ouvrir la caméra."
      setScanError(msg)
    }
  }

  function startDetection() {
    const hasBarcodeDetector = 'BarcodeDetector' in window

    if (hasBarcodeDetector) {
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
      const loop = async () => {
        if (!videoRef.current || !streamRef.current) return
        try {
          const codes = await detector.detect(videoRef.current)
          if (codes.length > 0) {
            await handleQRDetected(codes[0].rawValue)
            return
          }
        } catch {}
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
    } else {
      // Fallback: lire depuis un input file (photo)
      setScanError('Scanner automatique non disponible. Prenez une photo du QR code.')
    }
  }

  async function handleQRDetected(rawValue: string) {
    setScanStatus('found')
    stopCamera()

    try {
      // Le QR contient une URL comme https://.../scan/?t=TOKEN
      let token: string | null = null
      try {
        const url = new URL(rawValue)
        token = url.searchParams.get('t')
      } catch {
        // Peut-être juste le token directement
        token = rawValue.length === 36 ? rawValue : null
      }

      if (!token) { setScanError('QR code non reconnu. Réessayez.'); setScanStatus('idle'); return }

      await doCheckIn(token)
    } catch (err) {
      setScanError('Erreur lors du scan. Réessayez.')
      setScanStatus('idle')
    }
  }

  async function doCheckIn(token: string) {
    const userId = userIdRef.current
    const { data: truck } = await supabase.from('trucks').select('id, name, plate_number').eq('qr_token', token).single()
    if (!truck) { setScanError('QR code non reconnu dans la base.'); setScanStatus('idle'); return }

    // Fermer l'ancienne affectation active
    await supabase.from('assignments')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('worker_id', userId).eq('is_active', true)

    // Créer la nouvelle
    const { data: assign } = await supabase.from('assignments')
      .insert({ truck_id: truck.id, worker_id: userId })
      .select('id, truck_id, started_at, truck:trucks(name, plate_number)')
      .single()

    if (!assign) { setScanError('Erreur lors du check-in. Réessayez.'); setScanStatus('idle'); return }

    setAssignment(assign)
    setScreen('active')
    startGPS(userId, assign)
  }

  // ── ARRÊT ────────────────────────────────────────────────────────────────────

  async function handleCamionRange() {
    if (!assignment || stopping) return
    setStopping(true)
    stopGPS()
    await supabase.from('assignments')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('id', assignment.id)
    setScreen('done')
    setStopping(false)
  }

  async function handleLogout() {
    stopGPS(); stopCamera()
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

  // ── SCANNER QR ───────────────────────────────────────────────────────────────
  if (screen === 'scanning') return (
    <div className="min-h-screen bg-black flex flex-col" style={{ letterSpacing: '-0.01em' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-4 z-10">
        <button
          onClick={() => { stopCamera(); setScreen('no_truck'); setScanError('') }}
          className="w-10 h-10 bg-white/10 backdrop-blur rounded-full flex items-center justify-center"
        >
          <X className="w-5 h-5 text-white" />
        </button>
        <p className="text-white text-sm font-medium">Scanner le QR code</p>
        <div className="w-10" />
      </div>

      {/* Caméra */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />

        {/* Overlay scan */}
        {scanStatus === 'scanning' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {/* Cadre de scan */}
            <div className="relative w-64 h-64">
              {/* Coins du cadre */}
              {[['top-0 left-0','rounded-tl-2xl border-t-4 border-l-4'],
                ['top-0 right-0','rounded-tr-2xl border-t-4 border-r-4'],
                ['bottom-0 left-0','rounded-bl-2xl border-b-4 border-l-4'],
                ['bottom-0 right-0','rounded-br-2xl border-b-4 border-r-4']
              ].map(([pos, cls]) => (
                <div key={pos} className={`absolute w-8 h-8 border-accent ${pos} ${cls}`} />
              ))}
              {/* Ligne de scan animée */}
              <div className="absolute inset-x-2 top-0" style={{ animation: 'scanLine 2s ease-in-out infinite' }}>
                <div className="h-0.5 bg-accent shadow-lg" style={{ boxShadow: '0 0 8px #e1f970' }} />
              </div>
            </div>
            <p className="text-white text-sm mt-8 font-medium">Pointez vers le QR code du camion</p>
            <p className="text-white/50 text-xs mt-1">Détection automatique</p>
          </div>
        )}

        {/* Succès */}
        {scanStatus === 'found' && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mx-auto mb-4" style={{ boxShadow: '0 0 40px rgba(225,249,112,0.5)' }}>
                <CheckCircle className="w-10 h-10 text-black" />
              </div>
              <p className="text-white text-lg font-bold">QR détecté !</p>
              <p className="text-white/60 text-sm">Connexion en cours...</p>
            </div>
          </div>
        )}

        {/* Assombrissement des bords */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 200px 200px at center, transparent 50%, rgba(0,0,0,0.75) 100%)'
        }} />
      </div>

      {/* Erreur + fallback */}
      <div className="p-6 space-y-3" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
        {scanError && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-2xl p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-300 text-sm">{scanError}</p>
          </div>
        )}
        {/* Fallback: retenter */}
        <button
          onClick={() => { setScanError(''); setScanStatus('idle'); stopCamera(); setTimeout(openScanner, 300) }}
          className="w-full py-3.5 bg-white/10 border border-white/20 text-white text-sm font-medium rounded-2xl"
        >
          Réessayer
        </button>
      </div>

      <style>{`
        @keyframes scanLine {
          0%   { top: 8px;   opacity: 1; }
          50%  { top: calc(100% - 8px); opacity: 1; }
          100% { top: 8px;   opacity: 1; }
        }
      `}</style>
    </div>
  )

  // ── FIN DE SERVICE ───────────────────────────────────────────────────────────
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
        <div className="mt-10">
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 py-3 px-6 bg-bg-card border border-border-thin text-txt-muted text-sm rounded-xl hover:text-white hover:border-neutral-600 transition mx-auto"
          >
            <LogOut className="w-4 h-4" /> Se déconnecter
          </button>
        </div>
      </div>
    </div>
  )

  // ── PAS DE CAMION ────────────────────────────────────────────────────────────
  if (screen === 'no_truck') return (
    <div className="min-h-screen bg-bg-main flex flex-col p-6" style={{ letterSpacing: '-0.01em', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
      {/* Logo */}
      <div className="flex items-center gap-2 mb-auto pt-8">
        <Snowflake className="w-4 h-4 text-txt-muted" />
        <span className="text-txt-muted text-xs">FrigoTransport</span>
      </div>

      {/* Contenu centré */}
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        {/* Icône QR animée */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-accent/10 rounded-3xl blur-xl animate-pulse" />
          <div className="relative w-24 h-24 bg-bg-card border border-border-thin rounded-3xl flex items-center justify-center">
            <QrCode className="w-10 h-10 text-accent" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">{greeting}, {firstName} 👋</h1>
        <p className="text-txt-muted text-sm mb-1">Tu n'es encore assigné à aucun camion.</p>
        <p className="text-white/50 text-xs mb-10">Scanne le QR code affiché dans ton camion pour démarrer.</p>

        {/* Étapes simples */}
        <div className="w-full max-w-xs space-y-2.5 mb-10">
          {[
            { n: '1', txt: 'Monte dans ton camion' },
            { n: '2', txt: 'Repère le QR code sur le tableau de bord' },
            { n: '3', txt: 'Appuie sur le bouton ci-dessous et pointe la caméra' },
          ].map(({ n, txt }) => (
            <div key={n} className="flex items-center gap-3 bg-bg-card border border-border-thin rounded-2xl px-4 py-3 text-left">
              <div className="w-6 h-6 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0">
                <span className="text-accent text-xs font-bold">{n}</span>
              </div>
              <p className="text-white/80 text-sm">{txt}</p>
            </div>
          ))}
        </div>

        {/* BOUTON PRINCIPAL */}
        <button
          onClick={openScanner}
          className="w-full max-w-xs flex items-center justify-center gap-3 py-4 bg-accent text-black font-bold text-base rounded-2xl hover:bg-[#d2eb57] active:scale-[0.98] transition shadow-lg mb-3"
          style={{ boxShadow: '0 0 30px rgba(225,249,112,0.2)' }}
        >
          <Camera className="w-5 h-5" />
          Scanner mon camion
        </button>
      </div>

      {/* Déconnexion discrète */}
      <button
        onClick={handleLogout}
        className="flex items-center justify-center gap-2 text-txt-muted text-xs hover:text-white transition mt-4 mx-auto"
      >
        <LogOut className="w-3.5 h-3.5" /> Se déconnecter
      </button>

      <InstallPWA />
    </div>
  )

  // ── EN SERVICE ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-bg-main flex flex-col relative overflow-hidden" style={{ letterSpacing: '-0.01em' }}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-accent/4 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative flex-1 flex flex-col p-6 pt-12 max-w-sm mx-auto w-full">
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-1">
            <Snowflake className="w-3.5 h-3.5 text-txt-muted" />
            <span className="text-txt-muted text-xs">FrigoTransport</span>
          </div>
          <p className="text-txt-muted text-sm font-medium uppercase tracking-[0.15em] mb-1">{greeting}</p>
          <h1 className="text-4xl font-bold text-white tracking-tight">{firstName}</h1>
        </div>

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

        <div className="bg-bg-card border border-border-thin rounded-2xl px-4 py-3 flex items-center justify-between mb-8">
          <span className="text-txt-muted text-xs">Prise de poste</span>
          <span className="text-white text-xs font-medium">
            {assignment && new Date(assignment.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

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
