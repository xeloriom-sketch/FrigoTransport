'use client'

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import type { TruckPosition } from '@/types'

interface Props {
  positions: TruckPosition[]
  onRefresh?: () => void
  focusTruckId?: string | null
  followActive?: boolean
  darkMode?: boolean  // gardé pour compatibilité, n'affecte plus les tuiles
}

export interface LiveMapHandle {
  flyTo: (lat: number, lng: number, zoom?: number) => void
}

const LiveMap = forwardRef<LiveMapHandle, Props>(({
  positions, onRefresh, focusTruckId, followActive = false,
}, ref) => {
  const mapRef      = useRef<any>(null)
  const markersRef  = useRef<Map<string, any>>(new Map())
  const containerId = useRef(`live-map-${Math.random().toString(36).slice(2)}`)
  const prevPosRef  = useRef<Map<string, [number, number]>>(new Map())
  const headingRef  = useRef<Map<string, number>>(new Map())
  const statusRef   = useRef<Map<string, boolean>>(new Map())

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lng, zoom = 17) => {
      mapRef.current?.flyTo([lat, lng], zoom, { duration: 1.2, easeLinearity: 0.3 })
    }
  }))

  // Initialisation de la carte (une seule fois)
  useEffect(() => {
    const L = require('leaflet')
    if (mapRef.current) return

    mapRef.current = L.map(containerId.current, {
      center: [31.7917, -7.0926],
      zoom: 6,
      zoomControl: false,
      attributionControl: false,
    })

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 20,
    }).addTo(mapRef.current)

    L.control.attribution({ prefix: false, position: 'bottomright' })
      .addAttribution('<span style="font-size:9px;opacity:.35">© Esri · OSM</span>')
      .addTo(mapRef.current)

    L.control.zoom({ position: 'bottomleft' }).addTo(mapRef.current)

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markersRef.current.clear()
        prevPosRef.current.clear()
        headingRef.current.clear()
        statusRef.current.clear()
      }
    }
  }, [])

  // Focus sur un camion spécifique
  useEffect(() => {
    if (!focusTruckId || !mapRef.current) return
    const pos = positions.find(p => p.truck_id === focusTruckId)
    if (pos) mapRef.current.flyTo([pos.latitude, pos.longitude], 17, { duration: 1.2, easeLinearity: 0.3 })
  }, [focusTruckId])

  // Mise à jour des marqueurs
  useEffect(() => {
    if (!mapRef.current) return
    const L = require('leaflet')
    const seen = new Set<string>()
    const isFirstLoad = prevPosRef.current.size === 0

    positions.forEach(pos => {
      seen.add(pos.truck_id)
      const newLatlng: [number, number] = [pos.latitude, pos.longitude]
      const isActive = pos.is_active !== false
      const prev      = prevPosRef.current.get(pos.truck_id)
      const prevStatus = statusRef.current.get(pos.truck_id)

      // Calculer la direction (bearing) dès que la position change
      let heading = headingRef.current.get(pos.truck_id) ?? 0
      if (prev && (prev[0] !== newLatlng[0] || prev[1] !== newLatlng[1])) {
        heading = calcBearing(prev, newLatlng)
        headingRef.current.set(pos.truck_id, heading)
      }

      const existing = markersRef.current.get(pos.truck_id)

      if (existing) {
        // ── Position : interpolation RAF ────────────────────────────────
        if (prev && (prev[0] !== newLatlng[0] || prev[1] !== newLatlng[1])) {
          animateMarker(existing, prev, newLatlng, 900)
          // Rotation smooth via DOM (CSS transition s'en occupe)
          if (isActive) {
            const el = existing.getElement()
            const inner = el?.querySelector('.truck-inner') as HTMLElement | null
            if (inner) inner.style.transform = `rotate(${heading}deg)`
          }
        } else {
          existing.setLatLng(newLatlng)
        }

        // ── Icône : ne recréer QUE si le statut actif/rangé change ─────
        if (prevStatus !== isActive) {
          existing.setIcon(buildIcon(L, isActive, heading))
          statusRef.current.set(pos.truck_id, isActive)
        }

        existing.getPopup()?.setContent(popupContent(pos))

      } else {
        // ── Nouveau marqueur ─────────────────────────────────────────────
        const marker = L.marker(newLatlng, { icon: buildIcon(L, isActive, heading) })
          .addTo(mapRef.current)
          .bindPopup(popupContent(pos), {
            className: 'frigo-popup',
            closeButton: false,
            offset: [0, -16],
          })
        markersRef.current.set(pos.truck_id, marker)
        statusRef.current.set(pos.truck_id, isActive)

        // Animation d'apparition (scale + fade style Uber)
        requestAnimationFrame(() => {
          const el = marker.getElement()
          if (el) {
            el.style.transition = 'none'
            el.style.animation = 'markerAppear 0.45s cubic-bezier(0.175,0.885,0.32,1.275) both'
          }
        })
      }

      prevPosRef.current.set(pos.truck_id, newLatlng)
    })

    // ── Supprimer les camions sans données (avec animation) ─────────────
    markersRef.current.forEach((marker, id) => {
      if (seen.has(id)) return
      const el = marker.getElement()
      if (el) {
        el.style.animation = 'markerDisappear 0.25s ease forwards'
        setTimeout(() => { marker.remove(); markersRef.current.delete(id) }, 260)
      } else {
        marker.remove()
        markersRef.current.delete(id)
      }
    })

    // ── Auto-centrage ────────────────────────────────────────────────────
    if (followActive) {
      const active = positions.find(p => p.is_active !== false)
      if (active) {
        mapRef.current.setView(
          [active.latitude, active.longitude],
          Math.max(mapRef.current.getZoom(), 17),
          { animate: true, duration: 0.8 }
        )
      }
    } else if (isFirstLoad && positions.length === 1) {
      mapRef.current.setView([positions[0].latitude, positions[0].longitude], 15)
    } else if (isFirstLoad && positions.length > 1) {
      const active = positions.filter(p => p.is_active !== false)
      const toFit  = active.length > 0 ? active : positions
      const bounds = L.latLngBounds(toFit.map(p => [p.latitude, p.longitude]))
      mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 })
    }
  }, [positions, followActive])

  const activeCount = positions.filter(p => p.is_active !== false).length
  const parkedCount = positions.filter(p => p.is_active === false).length

  return (
    <>
      <style>{`
        /* ── Marqueurs ── */
        @keyframes ping {
          0%   { transform:scale(1);   opacity:.5 }
          70%  { transform:scale(2.8); opacity:0  }
          100% { transform:scale(2.8); opacity:0  }
        }
        @keyframes markerAppear {
          0%   { transform:scale(0.3) translateY(8px); opacity:0 }
          65%  { transform:scale(1.18) translateY(-2px); opacity:1 }
          85%  { transform:scale(0.94) }
          100% { transform:scale(1) translateY(0); opacity:1 }
        }
        @keyframes markerDisappear {
          to { transform:scale(0); opacity:0 }
        }
        /* ── Rotation fluide du camion (transition CSS) ── */
        .truck-inner {
          transition: transform 0.7s cubic-bezier(0.25,0.46,0.45,0.94);
        }
        /* ── Popup ── */
        @keyframes popupIn {
          from { transform:translateY(6px) scale(0.96); opacity:0 }
          to   { transform:translateY(0) scale(1); opacity:1 }
        }
        .frigo-popup .leaflet-popup-content-wrapper {
          background:#fff;
          border-radius:16px;
          box-shadow:0 8px 32px rgba(0,0,0,.16),0 2px 8px rgba(0,0,0,.08);
          padding:0;
          border:none;
          animation:popupIn 0.2s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        .frigo-popup .leaflet-popup-content { margin:0 }
        .frigo-popup .leaflet-popup-tip-container { margin-top:-1px }
        .frigo-popup .leaflet-popup-tip { background:#fff;box-shadow:none }
        /* ── Contrôles Leaflet ── */
        .leaflet-top,.leaflet-bottom { z-index:800 }
        .leaflet-control-zoom a {
          background:rgba(255,255,255,.96)!important;
          border:1px solid rgba(0,0,0,.1)!important;
          color:#333!important;
          box-shadow:0 2px 8px rgba(0,0,0,.1)!important;
        }
      `}</style>

      {/* Badge comptage */}
      {positions.length > 0 && (
        <div style={{ position:'absolute', top:12, left:12, zIndex:1000, pointerEvents:'none', animation:'fadeInBadge .3s ease both' }}>
          <div style={{ background:'rgba(255,255,255,0.96)', border:'1px solid rgba(0,0,0,0.1)', backdropFilter:'blur(10px)', color:'#111', padding:'5px 12px', borderRadius:999, display:'flex', alignItems:'center', gap:7, fontSize:11, fontWeight:600, boxShadow:'0 2px 12px rgba(0,0,0,.12)', letterSpacing:.1 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#16a34a', display:'inline-block', animation:'livePulse 2s ease-in-out infinite', flexShrink:0 }} />
            {activeCount} actif{activeCount !== 1 ? 's' : ''}
            {parkedCount > 0 && (
              <span style={{ color:'#9ca3af', marginLeft:1 }}>· {parkedCount} rangé{parkedCount !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
      )}

      {/* Bouton Refresh */}
      {onRefresh && (
        <button
          onClick={onRefresh}
          title="Actualiser"
          style={{ position:'absolute', top:12, right:12, zIndex:1000, width:36, height:36, background:'rgba(255,255,255,0.96)', border:'1px solid rgba(0,0,0,0.1)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', backdropFilter:'blur(10px)', boxShadow:'0 2px 12px rgba(0,0,0,.12)', transition:'transform .15s' }}
          onMouseEnter={e => (e.currentTarget.style.transform='scale(1.1)')}
          onMouseLeave={e => (e.currentTarget.style.transform='scale(1)')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
      )}

      <style>{`
        @keyframes livePulse    { 0%,100%{opacity:1} 50%{opacity:.25} }
        @keyframes fadeInBadge  { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div id={containerId.current} style={{ width:'100%', height:'100%' }} />
    </>
  )
})

LiveMap.displayName = 'LiveMap'
export default LiveMap

// ── Bearing : angle de déplacement (nord = 0°, sens horaire) ─────────────────
function calcBearing(from: [number, number], to: [number, number]): number {
  const φ1 = from[0] * Math.PI / 180
  const φ2 = to[0]   * Math.PI / 180
  const Δλ = (to[1] - from[1]) * Math.PI / 180
  const x  = Math.sin(Δλ) * Math.cos(φ2)
  const y  = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(x, y) * 180 / Math.PI) + 360) % 360
}

// ── Animation de position (interpolation requestAnimationFrame) ───────────────
function animateMarker(
  marker:     any,
  from:       [number, number],
  to:         [number, number],
  durationMs: number
) {
  const start                = performance.now()
  const [fromLat, fromLng]   = from
  const [toLat,   toLng]     = to
  const step = (now: number) => {
    const t    = Math.min((now - start) / durationMs, 1)
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t  // easeInOut
    marker.setLatLng([fromLat + (toLat - fromLat) * ease, fromLng + (toLng - fromLng) * ease])
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

// ── Construction de l'icône Leaflet ──────────────────────────────────────────
function buildIcon(L: any, isActive: boolean, heading: number) {
  const size = isActive ? 48 : 38
  const html = isActive
    ? `<div style="position:relative;width:48px;height:48px">
        <div style="position:absolute;inset:0;background:rgba(22,163,74,0.2);border-radius:50%;animation:ping 2.2s ease-out infinite"></div>
        <div class="truck-inner" style="position:absolute;inset:7px;background:#16a34a;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 18px rgba(22,163,74,0.55),0 1px 4px rgba(0,0,0,0.15);border:2.5px solid white;transform:rotate(${heading}deg)">
          ${navArrowSvg()}
        </div>
       </div>`
    : `<div style="position:relative;width:38px;height:38px">
        <div style="position:absolute;inset:5px;background:#64748b;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2.5px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.25)">
          ${truckSvg()}
        </div>
       </div>`
  return L.divIcon({
    className:    '',
    html,
    iconSize:     [size, size],
    iconAnchor:   [size / 2, size / 2],
    popupAnchor:  [0, -size / 2 - 6],
  })
}

// ── SVG icons ────────────────────────────────────────────────────────────────
function navArrowSvg() {
  // Flèche navigation pointant vers le haut (nord = 0°) — tourne avec le bearing
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="white">
    <path d="M12 2.5L5.5 20.5L12 17L18.5 20.5L12 2.5Z"/>
  </svg>`
}

function truckSvg() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="1" y="3" width="15" height="13" rx="2"/>
    <path d="M16 8h4l3 5v3h-7V8z"/>
    <circle cx="5.5" cy="18.5" r="2.5"/>
    <circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>`
}

// ── Popup ─────────────────────────────────────────────────────────────────────
function popupContent(pos: TruckPosition): string {
  const speed       = pos.speed != null ? `${Math.round(pos.speed * 3.6)} km/h` : '—'
  const ago         = timeAgo(pos.recorded_at)
  const isActive    = pos.is_active !== false
  const accent      = isActive ? '#16a34a' : '#94a3b8'
  const accentBg    = isActive ? '#dcfce7' : '#f1f5f9'
  const truckColor  = isActive ? '#16a34a' : '#94a3b8'

  return `<div style="padding:14px 15px;min-width:195px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#fff;border-radius:16px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <div style="width:36px;height:36px;background:${accentBg};border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="${truckColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/>
          <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
      </div>
      <div style="flex:1;min-width:0">
        <p style="font-weight:700;font-size:13px;color:#0f172a;margin:0;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${pos.truck_name}</p>
        <p style="color:#94a3b8;font-size:10px;margin:0;font-family:monospace;letter-spacing:.5px">${pos.plate_number}</p>
      </div>
      <span style="font-size:10px;font-weight:600;padding:3px 8px;border-radius:999px;background:${isActive ? 'rgba(22,163,74,.1)' : 'rgba(148,163,184,.12)'};color:${accent};white-space:nowrap;flex-shrink:0">
        ${isActive ? '● Live' : '○ Rangé'}
      </span>
    </div>
    <div style="background:#f8fafc;border-radius:10px;padding:8px 11px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
      <span style="color:#64748b;font-size:11px">Conducteur</span>
      <span style="color:#0f172a;font-size:11px;font-weight:600">${pos.worker_name || '—'}</span>
    </div>
    <div style="display:flex;gap:6px">
      <div style="flex:1;background:#f8fafc;border-radius:10px;padding:7px 8px;text-align:center">
        <p style="color:${accent};font-size:15px;font-weight:700;margin:0;line-height:1">${speed}</p>
        <p style="color:#94a3b8;font-size:9px;margin:2px 0 0;text-transform:uppercase;letter-spacing:.5px">vitesse</p>
      </div>
      <div style="flex:1;background:#f8fafc;border-radius:10px;padding:7px 8px;text-align:center">
        <p style="color:#475569;font-size:12px;font-weight:600;margin:0;line-height:1">${ago}</p>
        <p style="color:#94a3b8;font-size:9px;margin:2px 0 0;text-transform:uppercase;letter-spacing:.5px">signal</p>
      </div>
    </div>
  </div>`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const s    = Math.floor(diff / 1_000)
  if (s < 10)  return 'maintenant'
  if (s < 60)  return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60)  return `${m}min`
  return `${Math.floor(m / 60)}h`
}
