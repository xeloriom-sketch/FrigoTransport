'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Truck, Clock, MapPin, CheckCircle, LogOut, Snowflake, Camera, QrCode, X, AlertCircle, Navigation } from 'lucide-react'
import InstallPWA from '@/components/InstallPWA'
import WorkerNavigation from '@/components/WorkerNavigation'
import type { TruckPosition } from '@/types'

const LiveMap = dynamic(() => import('@/components/LiveMap'), { ssr: false })

type Screen  = 'loading' | 'active' | 'done' | 'no_truck' | 'scanning'
type Tab     = 'service' | 'navigation'

export default function WorkerPage() {
  const router = useRouter()
  const supabase = createClient()

  const [screen, setScreen]             = useState<Screen>('loading')
  const [tab, setTab]                   = useState<Tab>('service')
  const [profile, setProfile]           = useState<{ full_name: string; id: string } | null>(null)
  const [assignment, setAssignment]     = useState<any>(null)
  const [elapsed, setElapsed]           = useState('')
  const [gpsActive, setGpsActive]       = useState(false)
  const [stopping, setStopping]         = useState(false)
  const [scanError, setScanError]       = useState('')
  const [scanStatus, setScanStatus]     = useState<'idle' | 'scanning' | 'found'>('idle')
  const [myPosition, setMyPosition]     = useState<TruckPosition | null>(null)
  const [showMap, setShowMap]           = useState(false)
  const [adminDestination, setAdminDest] = useState<{address:string;lat:number;lng:number} | null>(null)

  const watchIdRef    = useRef<number | null>(null)
  const lastSentRef   = useRef<number>(0)
  const wakeLockRef   = useRef<any>(null)
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

    // Écouter les destinations envoyées par l'admin via Realtime broadcast
    const channel = supabase.channel(`worker-dest-${user.id}`)
      .on('broadcast', { event: 'set_destination' }, ({ payload }) => {
        if (payload?.address) {
          setAdminDest({ address: payload.address, lat: payload.lat, lng: payload.lng })
          setTab('navigation') // Basculer automatiquement sur l'onglet Navigation
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }

  // ── GPS ─────────────────────────────────────────────────────────────────────

  async function acquireWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen')
      }
    } catch {}
  }

  function startGPS(userId: string, assign: any) {
    if (!('geolocation' in navigator)) return

    // Garder l'écran allumé (évite la veille qui coupe le GPS)
    acquireWakeLock()

    // Re-acquérir le wake lock si l'app revient au premier plan
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        await acquireWakeLock()
        // Redémarrer watchPosition si nécessaire
        if (watchIdRef.current === null) {
          startGPS(userId, assign)
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        setGpsActive(true)
        // Mettre à jour la carte en temps réel
        setMyPosition({
          truck_id: assign.truck_id,
          truck_name: assign.truck?.name ?? 'Mon camion',
          plate_number: assign.truck?.plate_number ?? '',
          worker_name: profile?.full_name ?? 'Moi',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
          speed: pos.coords.speed ?? null,
          recorded_at: new Date().toISOString(),
          assignment_id: assign.id,
          is_active: true,
        })
        const now = Date.now()
        if (now - lastSentRef.current < 5_000) return
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
      (err) => { console.warn('GPS error:', err.code) },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20000 }
    )
  }

  function stopGPS() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (wakeLockRef.current) {
      wakeLockRef.current.release?.().catch(() => {})
      wakeLockRef.current = null
    }
    setGpsActive(false)
    setMyPosition(null)
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

    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError("Caméra non disponible sur ce navigateur. Utilisez Safari sur iPhone.")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => {
            setScanStatus('scanning')
            startDetection()
          })
        }
      }
    } catch (err: any) {
      const msg = err.name === 'NotAllowedError'
        ? "Caméra refusée — allez dans Réglages > Safari > Caméra et autorisez."
        : err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError'
        ? "Aucune caméra trouvée sur cet appareil."
        : err.name === 'NotReadableError'
        ? "Caméra utilisée par une autre app, fermez-la puis réessayez."
        : `Erreur caméra : ${err.message || err.name}`
      setScanError(msg)
    }
  }

  function startDetection() {
    const canvasEl = document.createElement('canvas')
    const ctx = canvasEl.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    let detected = false

    const loop = async () => {
      if (detected || !videoRef.current || !streamRef.current) return
      const video = videoRef.current

      // Attendre que la vidéo ait des données
      if (video.readyState < 2 || video.videoWidth === 0) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      canvasEl.width  = video.videoWidth
      canvasEl.height = video.videoHeight
      ctx.drawImage(video, 0, 0, canvasEl.width, canvasEl.height)

      try {
        // 1. BarcodeDetector natif (Chrome Android, iOS 17+) — le plus rapide
        if ('BarcodeDetector' in window) {
          const codes = await (window as any).BarcodeDetector.detect(video)
          if (codes.length > 0) {
            detected = true
            await handleQRDetected(codes[0].rawValue)
            return
          }
        }

        // 2. jsQR — fallback universel (tous iOS/Android)
        const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height)
        const jsQR = (await import('jsqr')).default
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        })
        if (code?.data) {
          detected = true
          await handleQRDetected(code.data)
          return
        }
      } catch {}

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
  }

  async function handleQRDetected(rawValue: string) {
    setScanStatus('found')
    stopCamera()

    try {
      let token: string | null = null
      // Format 1 : URL complète https://.../scan/?t=UUID
      try { token = new URL(rawValue).searchParams.get('t') } catch {}
      // Format 2 : UUID brut
      if (!token && /^[0-9a-f-]{36}$/i.test(rawValue.trim())) token = rawValue.trim()

      if (!token) {
        setScanError('QR code non reconnu — ce n\'est pas un QR FrigoTransport.')
        setScanStatus('idle')
        return
      }

      await doCheckIn(token)
    } catch {
      setScanError('Erreur réseau. Vérifiez votre connexion et réessayez.')
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
    <div className="fixed inset-0 bg-black flex flex-col" style={{ letterSpacing: '-0.01em' }}>

      {/* Header fixe */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4"
        style={{ paddingTop: 'max(48px, env(safe-area-inset-top))' }}>
        <button
          onClick={() => { stopCamera(); setScreen('no_truck'); setScanError('') }}
          className="w-11 h-11 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20"
        >
          <X className="w-5 h-5 text-white" />
        </button>
        <div className="bg-black/50 backdrop-blur-md border border-white/20 rounded-full px-4 py-2">
          <p className="text-white text-sm font-medium">Scanner le camion</p>
        </div>
        <div className="w-11" />
      </div>

      {/* Vidéo plein écran */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline muted autoPlay
      />

      {/* Overlay sombre sur les bords avec découpe centrale */}
      <div className="absolute inset-0 z-10 pointer-events-none" style={{
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.7) 100%)'
      }} />

      {/* Zone de scan centrale */}
      {scanStatus === 'scanning' && !scanError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
          <div className="relative w-72 h-72">
            {/* Ombre autour du cadre */}
            <div className="absolute inset-0 rounded-3xl" style={{
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)'
            }} />
            {/* Coins accent */}
            {[
              'top-0 left-0 rounded-tl-3xl border-t-[3px] border-l-[3px]',
              'top-0 right-0 rounded-tr-3xl border-t-[3px] border-r-[3px]',
              'bottom-0 left-0 rounded-bl-3xl border-b-[3px] border-l-[3px]',
              'bottom-0 right-0 rounded-br-3xl border-b-[3px] border-r-[3px]',
            ].map(cls => (
              <div key={cls} className={`absolute w-10 h-10 border-accent ${cls}`} />
            ))}
            {/* Ligne scan */}
            <div className="absolute inset-x-3" style={{ animation: 'scanLine 2s ease-in-out infinite', top: 0 }}>
              <div className="h-0.5 bg-accent rounded-full" style={{ boxShadow: '0 0 12px #e1f970, 0 0 4px #e1f970' }} />
            </div>
          </div>
          <p className="text-white text-sm font-semibold mt-8 drop-shadow-lg">Centrez le QR code dans le cadre</p>
          <p className="text-white/60 text-xs mt-1">Détection automatique</p>
        </div>
      )}

      {/* Succès */}
      {scanStatus === 'found' && (
        <div className="absolute inset-0 z-20 bg-black/70 flex items-center justify-center">
          <div className="text-center">
            <div className="w-24 h-24 bg-accent rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ boxShadow: '0 0 60px rgba(225,249,112,0.6)' }}>
              <CheckCircle className="w-12 h-12 text-black" />
            </div>
            <p className="text-white text-xl font-bold">QR détecté !</p>
            <p className="text-white/60 text-sm mt-1">Connexion au camion...</p>
          </div>
        </div>
      )}

      {/* ERREUR — bien visible au centre */}
      {scanError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-xs bg-bg-card border border-red-500/30 rounded-3xl p-6 text-center shadow-2xl">
            <div className="w-14 h-14 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7 text-red-400" />
            </div>
            <p className="text-white font-semibold text-sm mb-2">Problème de scanner</p>
            <p className="text-red-300 text-sm leading-relaxed mb-5">{scanError}</p>
            <button
              onClick={() => { setScanError(''); setScanStatus('idle'); stopCamera(); setTimeout(openScanner, 400) }}
              className="w-full py-3 bg-accent text-black text-sm font-bold rounded-2xl mb-2"
            >
              Réessayer
            </button>
            <button
              onClick={() => { stopCamera(); setScreen('no_truck'); setScanError('') }}
              className="w-full py-2.5 text-txt-muted text-sm"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Bouton bas — Réessayer discret quand pas d'erreur */}
      {!scanError && scanStatus === 'scanning' && (
        <div className="absolute bottom-0 left-0 right-0 z-20 p-5"
          style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
          <button
            onClick={() => { stopCamera(); setScreen('no_truck') }}
            className="w-full py-3 bg-black/40 backdrop-blur-md border border-white/20 text-white/70 text-sm rounded-2xl"
          >
            Annuler
          </button>
        </div>
      )}

      <style>{`
        @keyframes scanLine {
          0%   { top: 4px;              }
          50%  { top: calc(100% - 4px); }
          100% { top: 4px;              }
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
    <div className="min-h-screen bg-bg-main flex flex-col" style={{ letterSpacing: '-0.01em', padding: 'max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left))' }}>
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

      <div className="relative flex-1 flex flex-col p-6 max-w-sm mx-auto w-full" style={{ paddingTop: 'max(48px, env(safe-area-inset-top))' }}>
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-1">
            <Snowflake className="w-3.5 h-3.5 text-txt-muted" />
            <span className="text-txt-muted text-xs">FrigoTransport</span>
          </div>
          <p className="text-txt-muted text-sm font-medium uppercase tracking-[0.15em] mb-1">{greeting}</p>
          <h1 className="text-4xl font-bold text-white tracking-tight">{firstName}</h1>
        </div>

        <div className="bg-bg-card border border-border-thin rounded-3xl p-5 mb-4"
          style={{ animation: 'fadeInUp .4s cubic-bezier(0.22,1,0.36,1) both' }}>
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

        {/* Prise de poste */}
        <div className="bg-bg-card border border-border-thin rounded-2xl px-4 py-3 flex items-center justify-between"
          style={{ animation: 'fadeInUp .4s cubic-bezier(0.22,1,0.36,1) both', animationDelay: '60ms' }}>
          <span className="text-txt-muted text-xs">Prise de poste</span>
          <span className="text-white text-xs font-medium">
            {assignment && new Date(assignment.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Carte de position — toggle */}
        <button
          onClick={() => setShowMap(v => !v)}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-bg-card border border-border-thin text-txt-muted text-xs font-medium rounded-2xl hover:text-white hover:border-neutral-600 transition"
        >
          <Navigation className="w-3.5 h-3.5" />
          {showMap ? 'Masquer ma position' : 'Voir ma position sur la carte'}
        </button>

        {showMap && myPosition && (
          <div className="rounded-2xl overflow-hidden border border-border-thin" style={{ height: 260 }}>
            <LiveMap positions={[myPosition]} followActive={true} darkMode={false} />
          </div>
        )}

        {showMap && !myPosition && (
          <div className="rounded-2xl border border-border-thin bg-bg-card p-6 text-center">
            <p className="text-txt-muted text-xs">En attente du signal GPS...</p>
          </div>
        )}

        {/* Bouton Camion rangé */}
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
          className="mt-2 w-full flex items-center justify-center gap-2 py-2 text-txt-muted text-xs hover:text-white transition rounded-xl"
        >
          <LogOut className="w-3.5 h-3.5" /> Se déconnecter
        </button>
      </div>
    </div>
  )
}
