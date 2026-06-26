'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Search, MapPin, Navigation, X, ExternalLink, Loader2, Clock } from 'lucide-react'
import type { TruckPosition } from '@/types'

const LiveMap = dynamic(() => import('./LiveMap'), { ssr: false })

interface Destination {
  address: string
  lat: number
  lng: number
}

interface Props {
  myPosition: TruckPosition | null
  assignmentId: string | null
  // Destination envoyée par l'admin via Realtime
  adminDestination: Destination | null
}

export default function WorkerNavigation({ myPosition, assignmentId, adminDestination }: Props) {
  const [query, setQuery]             = useState('')
  const [results, setResults]         = useState<any[]>([])
  const [searching, setSearching]     = useState(false)
  const [destination, setDestination] = useState<Destination | null>(null)
  const [showResults, setShowResults] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Charger la destination depuis localStorage au démarrage
  useEffect(() => {
    const saved = localStorage.getItem(`dest_${assignmentId}`)
    if (saved) {
      try { setDestination(JSON.parse(saved)) } catch {}
    }
  }, [assignmentId])

  // Destination envoyée par l'admin → priorité
  useEffect(() => {
    if (adminDestination) {
      setDestination(adminDestination)
      if (assignmentId) localStorage.setItem(`dest_${assignmentId}`, JSON.stringify(adminDestination))
      setQuery(adminDestination.address)
    }
  }, [adminDestination, assignmentId])

  // Recherche d'adresse avec Nominatim (OpenStreetMap) — debounce 600ms
  const search = useCallback(async (q: string) => {
    if (q.trim().length < 3) { setResults([]); setShowResults(false); return }
    setSearching(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`,
        { headers: { 'Accept-Language': 'fr' } }
      )
      const data = await res.json()
      setResults(data)
      setShowResults(true)
    } catch {}
    setSearching(false)
  }, [])

  function handleQueryChange(v: string) {
    setQuery(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(v), 600)
  }

  function selectResult(r: any) {
    const dest: Destination = {
      address: r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    }
    setDestination(dest)
    setQuery(r.display_name)
    setShowResults(false)
    if (assignmentId) localStorage.setItem(`dest_${assignmentId}`, JSON.stringify(dest))
  }

  function clearDestination() {
    setDestination(null)
    setQuery('')
    if (assignmentId) localStorage.removeItem(`dest_${assignmentId}`)
  }

  function openInMaps() {
    if (!destination) return
    const { lat, lng, address } = destination
    // iOS → Apple Maps, Android → Google Maps
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const url = isIOS
      ? `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
    window.open(url, '_blank')
  }

  // Distance à vol d'oiseau
  function distance(): string | null {
    if (!myPosition || !destination) return null
    const R = 6371
    const dLat = ((destination.lat - myPosition.latitude) * Math.PI) / 180
    const dLng = ((destination.lng - myPosition.longitude) * Math.PI) / 180
    const a = Math.sin(dLat/2)**2 + Math.cos(myPosition.latitude*Math.PI/180)*Math.cos(destination.lat*Math.PI/180)*Math.sin(dLng/2)**2
    const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
  }

  // Positions pour la carte : ma position + destination
  const mapPositions: TruckPosition[] = []
  if (myPosition) mapPositions.push({ ...myPosition, is_active: true })

  // Marqueur destination (camion rangé = pin différent)
  const destPosition: TruckPosition | null = destination ? {
    truck_id: 'destination',
    truck_name: '🏁 Destination',
    plate_number: '',
    worker_name: destination.address.split(',')[0],
    latitude: destination.lat,
    longitude: destination.lng,
    accuracy: null,
    speed: null,
    recorded_at: new Date().toISOString(),
    assignment_id: '',
    is_active: false,
  } : null

  if (destPosition) mapPositions.push(destPosition)

  const dist = distance()

  return (
    <div className="flex flex-col gap-4">

      {/* Barre de recherche */}
      <div className="relative">
        <div className="flex items-center gap-3 bg-bg-card border border-border-thin rounded-2xl px-4 py-3">
          {searching
            ? <Loader2 className="w-4 h-4 text-txt-muted animate-spin shrink-0" />
            : <Search className="w-4 h-4 text-txt-muted shrink-0" />}
          <input
            type="text"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            onFocus={() => results.length > 0 && setShowResults(true)}
            placeholder="Rechercher une adresse de livraison..."
            className="flex-1 bg-transparent text-white text-sm placeholder-txt-muted focus:outline-none"
          />
          {query && (
            <button onClick={clearDestination} className="p-1 text-txt-muted hover:text-white transition shrink-0">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Résultats de recherche */}
        {showResults && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-bg-card border border-border-thin rounded-2xl overflow-hidden z-50 shadow-2xl"
            style={{ animation: 'slideDown .15s ease' }}>
            {results.map((r, i) => {
              const parts = r.display_name.split(', ')
              const main = parts.slice(0, 2).join(', ')
              const sub = parts.slice(2, 4).join(', ')
              return (
                <button
                  key={i}
                  onClick={() => selectResult(r)}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-bg-input transition text-left border-b border-border-thin last:border-0"
                >
                  <MapPin className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{main}</p>
                    <p className="text-txt-muted text-xs truncate">{sub}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Notification destination reçue de l'admin */}
      {adminDestination && (
        <div className="bg-accent/10 border border-accent/20 rounded-2xl px-4 py-3 flex items-center gap-3">
          <MapPin className="w-4 h-4 text-accent shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-accent text-xs font-semibold">Destination assignée par le patron</p>
            <p className="text-white/70 text-xs mt-0.5 truncate">{adminDestination.address}</p>
          </div>
        </div>
      )}

      {/* Carte */}
      <div className="rounded-2xl overflow-hidden border border-border-thin" style={{ height: 300 }}>
        {mapPositions.length > 0
          ? <LiveMap positions={mapPositions} followActive={true} darkMode={false} />
          : (
            <div className="h-full bg-bg-card flex flex-col items-center justify-center gap-2">
              <MapPin className="w-8 h-8 text-txt-muted" />
              <p className="text-txt-muted text-sm">En attente du GPS...</p>
            </div>
          )
        }
      </div>

      {/* Infos trajet */}
      {destination && (
        <div className="bg-bg-card border border-border-thin rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-accent/15 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-4 h-4 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-txt-muted uppercase tracking-wider mb-1">Destination</p>
              <p className="text-white text-sm font-medium leading-snug">{destination.address.split(',').slice(0, 3).join(', ')}</p>
            </div>
          </div>

          {dist && (
            <div className="flex items-center gap-3 py-2 border-t border-border-thin">
              <div className="w-8 h-8 bg-bg-input rounded-xl flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-txt-muted" />
              </div>
              <div>
                <p className="text-[10px] text-txt-muted uppercase tracking-wider">Distance à vol d'oiseau</p>
                <p className="text-white font-semibold text-sm">{dist}</p>
              </div>
            </div>
          )}

          <button
            onClick={openInMaps}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-accent text-black font-bold text-sm rounded-2xl hover:bg-[#d2eb57] active:scale-[0.98] transition"
            style={{ boxShadow: '0 0 20px rgba(225,249,112,0.2)' }}
          >
            <Navigation className="w-4 h-4" />
            Lancer la navigation
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </button>
          <p className="text-center text-txt-muted text-[10px]">Ouvre Apple Maps ou Google Maps</p>
        </div>
      )}

      {!destination && !myPosition && (
        <div className="bg-bg-card border border-border-thin rounded-2xl p-5 text-center">
          <Navigation className="w-8 h-8 text-txt-muted mx-auto mb-2" />
          <p className="text-white text-sm font-medium">Naviguez vers vos livraisons</p>
          <p className="text-txt-muted text-xs mt-1">Scannez votre camion pour démarrer le GPS,<br/>puis recherchez votre destination ci-dessus.</p>
        </div>
      )}
    </div>
  )
}
