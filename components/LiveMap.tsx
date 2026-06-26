'use client'

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import type { TruckPosition } from '@/types'

interface Props {
  positions: TruckPosition[]
  onRefresh?: () => void
  focusTruckId?: string | null
  followActive?: boolean   // auto-centre sur le camion actif (mode ouvrier)
  darkMode?: boolean       // carte sombre (admin) vs claire (ouvrier)
}

export interface LiveMapHandle {
  flyTo: (lat: number, lng: number, zoom?: number) => void
}

const LiveMap = forwardRef<LiveMapHandle, Props>(({
  positions, onRefresh, focusTruckId, followActive = false, darkMode = false
}, ref) => {
  const mapRef      = useRef<any>(null)
  const markersRef  = useRef<Map<string, any>>(new Map())
  const containerId = useRef(`live-map-${Math.random().toString(36).slice(2)}`)
  const prevPosRef  = useRef<Map<string, [number, number]>>(new Map())

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lng, zoom = 17) => {
      mapRef.current?.flyTo([lat, lng], zoom, { duration: 1.2, easeLinearity: 0.3 })
    }
  }))

  useEffect(() => {
    const L = require('leaflet')
    if (mapRef.current) return

    mapRef.current = L.map(containerId.current, {
      center: [31.7917, -7.0926],
      zoom: 6,
      zoomControl: false,
      attributionControl: false,
    })

    // Tuiles Esri World Street Map — rues, restaurants, bâtiments, niveau Google Maps
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 20,
      attribution: '',
    }).addTo(mapRef.current)

    L.control.attribution({ prefix: false, position: 'bottomright' })
      .addAttribution('<span style="font-size:9px;opacity:.4">© Esri · OSM</span>')
      .addTo(mapRef.current)

    L.control.zoom({ position: 'bottomleft' }).addTo(mapRef.current)

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markersRef.current.clear()
        prevPosRef.current.clear()
      }
    }
  }, [darkMode])

  // Focus sur un camion spécifique quand focusTruckId change
  useEffect(() => {
    if (!focusTruckId || !mapRef.current) return
    const pos = positions.find(p => p.truck_id === focusTruckId)
    if (pos) mapRef.current.flyTo([pos.latitude, pos.longitude], 16, { duration: 1.0 })
  }, [focusTruckId])

  // Mise à jour des marqueurs avec animation fluide
  useEffect(() => {
    if (!mapRef.current) return
    const L = require('leaflet')
    const seen = new Set<string>()

    positions.forEach(pos => {
      seen.add(pos.truck_id)
      const newLatlng: [number, number] = [pos.latitude, pos.longitude]
      const isActive = pos.is_active !== false
      const prev = prevPosRef.current.get(pos.truck_id)

      const iconHtml = isActive
        ? `<div style="position:relative;width:44px;height:44px">
            <div style="position:absolute;inset:0;background:rgba(22,163,74,0.25);border-radius:50%;animation:ping 2s ease-out infinite"></div>
            <div style="position:absolute;inset:6px;background:#16a34a;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 14px rgba(22,163,74,0.5);border:2.5px solid white">
              ${truckSvg('#fff')}
            </div>
           </div>`
        : `<div style="position:relative;width:36px;height:36px">
            <div style="position:absolute;inset:4px;background:#6b7280;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
              ${truckSvg('#fff')}
            </div>
           </div>`

      const size = isActive ? 44 : 36
      const icon = L.divIcon({
        className: '',
        html: iconHtml,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2 - 4],
      })

      const existing = markersRef.current.get(pos.truck_id)
      if (existing) {
        // Animation fluide : interpolation si la position a changé
        if (prev && (prev[0] !== newLatlng[0] || prev[1] !== newLatlng[1])) {
          animateMarker(existing, prev, newLatlng, 800)
        } else {
          existing.setLatLng(newLatlng)
        }
        existing.setIcon(icon)
        existing.getPopup()?.setContent(popupContent(pos, darkMode))
      } else {
        const marker = L.marker(newLatlng, { icon })
          .addTo(mapRef.current)
          .bindPopup(popupContent(pos, darkMode), {
            className: darkMode ? 'frigo-popup-dark' : 'frigo-popup-light',
            closeButton: false,
            offset: [0, -14],
          })
        markersRef.current.set(pos.truck_id, marker)
      }
      prevPosRef.current.set(pos.truck_id, newLatlng)
    })

    // Supprimer les camions sans données
    markersRef.current.forEach((marker, id) => {
      if (!seen.has(id)) { marker.remove(); markersRef.current.delete(id) }
    })

    // Auto-centrage
    if (followActive) {
      const active = positions.find(p => p.is_active !== false)
      if (active) {
        mapRef.current.setView([active.latitude, active.longitude], Math.max(mapRef.current.getZoom(), 17), { animate: true, duration: 0.8 })
      }
    } else if (positions.length === 1 && !mapRef.current._loaded) {
      mapRef.current.setView([positions[0].latitude, positions[0].longitude], 14)
    } else if (positions.length > 1 && positions.every(p => prevPosRef.current.size === 0)) {
      const active = positions.filter(p => p.is_active !== false)
      const toFit = active.length > 0 ? active : positions
      const bounds = L.latLngBounds(toFit.map(p => [p.latitude, p.longitude]))
      mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 })
    }
  }, [positions, followActive, darkMode])

  return (
    <>
      <style>{`
        @keyframes ping {
          0%   { transform:scale(1);   opacity:.6 }
          70%  { transform:scale(2.5); opacity:0  }
          100% { transform:scale(2.5); opacity:0  }
        }
        /* Popup sombre (admin) */
        .frigo-popup-dark .leaflet-popup-content-wrapper {
          background:#18181b;border:1px solid #27272a;border-radius:14px;
          box-shadow:0 8px 32px rgba(0,0,0,.7);padding:0;
        }
        .frigo-popup-dark .leaflet-popup-content { margin:0 }
        .frigo-popup-dark .leaflet-popup-tip-container { display:none }
        /* Popup clair (ouvrier) */
        .frigo-popup-light .leaflet-popup-content-wrapper {
          background:#fff;border-radius:14px;
          box-shadow:0 4px 20px rgba(0,0,0,.15);padding:0;border:none;
        }
        .frigo-popup-light .leaflet-popup-content { margin:0 }
        .frigo-popup-light .leaflet-popup-tip { background:#fff }
        .leaflet-top,.leaflet-bottom { z-index:800 }
      `}</style>

      {/* Badge comptage camions */}
      {positions.length > 0 && (
        <div style={{ position:'absolute', top:12, left:12, zIndex:1000, pointerEvents:'none' }}>
          <div style={{ background:'rgba(255,255,255,0.95)', border:'1px solid rgba(0,0,0,0.12)', backdropFilter:'blur(8px)', color:'#111', padding:'5px 11px', borderRadius:999, display:'flex', alignItems:'center', gap:6, fontSize:11, fontWeight:600, boxShadow:'0 2px 12px rgba(0,0,0,0.15)' }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#16a34a', display:'inline-block', animation:'livePulse 2s ease-in-out infinite', flexShrink:0 }} />
            {positions.filter(p => p.is_active !== false).length} actif{positions.filter(p => p.is_active !== false).length !== 1 ? 's' : ''}
            {positions.some(p => p.is_active === false) && (
              <span style={{ color:'#9ca3af', marginLeft:2 }}>· {positions.filter(p => p.is_active === false).length} rangé{positions.filter(p => p.is_active === false).length !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
      )}

      {/* Bouton Refresh */}
      {onRefresh && (
        <button
          onClick={onRefresh}
          title="Actualiser"
          style={{ position:'absolute', top:12, right:12, zIndex:1000, width:36, height:36, background:'rgba(255,255,255,0.95)', border:'1px solid rgba(0,0,0,0.12)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', backdropFilter:'blur(8px)', boxShadow:'0 2px 12px rgba(0,0,0,0.15)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
      )}

      <style>{`@keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>
      <div id={containerId.current} style={{ width:'100%', height:'100%' }} />
    </>
  )
})

LiveMap.displayName = 'LiveMap'
export default LiveMap

// ── Animation fluide du marqueur ─────────────────────────────────────────────

function animateMarker(
  marker: any,
  from: [number, number],
  to: [number, number],
  durationMs: number
) {
  const start = performance.now()
  const [fromLat, fromLng] = from
  const [toLat, toLng] = to

  const step = (now: number) => {
    const t = Math.min((now - start) / durationMs, 1)
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t // easeInOut
    marker.setLatLng([
      fromLat + (toLat - fromLat) * ease,
      fromLng + (toLng - fromLng) * ease,
    ])
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function truckSvg(color: string) {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`
}

function popupContent(pos: TruckPosition, dark: boolean): string {
  const speed = pos.speed != null ? `${Math.round(pos.speed * 3.6)} km/h` : '—'
  const ago = timeAgo(pos.recorded_at)
  const isActive = pos.is_active !== false
  const bg = dark ? '#18181b' : '#fff'
  const cardBg = dark ? '#27272a' : '#f4f4f5'
  const txt = dark ? '#fff' : '#111'
  const sub = dark ? '#71717a' : '#6b7280'
  const accentColor = isActive ? (dark ? '#e1f970' : '#16a34a') : '#9ca3af'

  return `
    <div style="padding:12px 14px;min-width:180px;font-family:-apple-system,sans-serif;background:${bg};border-radius:14px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <div style="width:32px;height:32px;background:${isActive ? accentColor : cardBg};border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${truckSvg(isActive ? (dark ? '#000' : '#fff') : '#9ca3af')}
        </div>
        <div style="flex:1">
          <p style="font-weight:700;font-size:13px;color:${txt};margin:0;line-height:1.2">${pos.truck_name}</p>
          <p style="color:${sub};font-size:10px;margin:0;font-family:monospace">${pos.plate_number}</p>
        </div>
        <span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:999px;background:${isActive ? (dark ? 'rgba(225,249,112,.15)' : 'rgba(22,163,74,.1)') : 'rgba(100,100,100,.1)'};color:${accentColor}">
          ${isActive ? '● Live' : '○ Rangé'}
        </span>
      </div>
      <div style="background:${cardBg};border-radius:8px;padding:7px 10px;margin-bottom:7px;display:flex;justify-content:space-between">
        <span style="color:${sub};font-size:11px">Conducteur</span>
        <span style="color:${txt};font-size:11px;font-weight:600">${pos.worker_name}</span>
      </div>
      <div style="display:flex;gap:6px">
        <div style="flex:1;background:${cardBg};border-radius:8px;padding:6px 8px;text-align:center">
          <p style="color:${accentColor};font-size:14px;font-weight:700;margin:0">${speed}</p>
          <p style="color:${sub};font-size:9px;margin:0">vitesse</p>
        </div>
        <div style="flex:1;background:${cardBg};border-radius:8px;padding:6px 8px;text-align:center">
          <p style="color:${sub};font-size:11px;font-weight:600;margin:0">${ago}</p>
          <p style="color:${sub};font-size:9px;margin:0">mis à jour</p>
        </div>
      </div>
    </div>
  `
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const s = Math.floor(diff / 1_000)
  if (s < 10) return 'maintenant'
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}min`
  return `${Math.floor(m / 60)}h`
}
