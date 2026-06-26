'use client'

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import type { TruckPosition } from '@/types'

interface Props {
  positions: TruckPosition[]
  onRefresh?: () => void
  focusTruckId?: string | null
}

export interface LiveMapHandle {
  flyTo: (lat: number, lng: number, zoom?: number) => void
}

const LiveMap = forwardRef<LiveMapHandle, Props>(({ positions, onRefresh, focusTruckId }, ref) => {
  const mapRef      = useRef<any>(null)
  const markersRef  = useRef<Map<string, any>>(new Map())
  const containerId = useRef(`live-map-${Math.random().toString(36).slice(2)}`)

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lng, zoom = 15) => {
      mapRef.current?.flyTo([lat, lng], zoom, { duration: 1.2 })
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

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, subdomains: 'abcd',
    }).addTo(mapRef.current)

    L.control.attribution({ prefix: false, position: 'bottomright' })
      .addAttribution('<span style="color:#444;font-size:9px">© CARTO · OSM</span>')
      .addTo(mapRef.current)

    L.control.zoom({ position: 'bottomleft' }).addTo(mapRef.current)

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markersRef.current.clear() }
    }
  }, [])

  // Focus sur un camion spécifique
  useEffect(() => {
    if (!focusTruckId || !mapRef.current) return
    const pos = positions.find(p => p.truck_id === focusTruckId)
    if (pos) mapRef.current.flyTo([pos.latitude, pos.longitude], 15, { duration: 1.2 })
  }, [focusTruckId])

  // Mise à jour des marqueurs
  useEffect(() => {
    if (!mapRef.current) return
    const L = require('leaflet')
    const seen = new Set<string>()

    positions.forEach(pos => {
      seen.add(pos.truck_id)
      const latlng: [number, number] = [pos.latitude, pos.longitude]
      const isActive = pos.is_active !== false

      const iconHtml = isActive
        ? `<div style="position:relative;width:40px;height:40px">
            <div style="position:absolute;inset:0;background:rgba(225,249,112,0.18);border-radius:50%;animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite"></div>
            <div style="position:absolute;inset:5px;background:#e1f970;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 14px rgba(225,249,112,0.7)">
              ${truckSvg('#000')}
            </div>
           </div>`
        : `<div style="position:relative;width:36px;height:36px">
            <div style="position:absolute;inset:4px;background:#3f3f3f;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #555;box-shadow:0 0 8px rgba(0,0,0,0.5)">
              ${truckSvg('#888')}
            </div>
           </div>`

      const size = isActive ? 40 : 36
      const icon = L.divIcon({ className: '', html: iconHtml, iconSize: [size, size], iconAnchor: [size/2, size/2], popupAnchor: [0, -size/2-4] })

      const existing = markersRef.current.get(pos.truck_id)
      if (existing) {
        existing.setLatLng(latlng)
        existing.setIcon(icon)
        existing.getPopup()?.setContent(popupContent(pos))
      } else {
        const marker = L.marker(latlng, { icon })
          .addTo(mapRef.current)
          .bindPopup(popupContent(pos), { className: 'frigo-popup', closeButton: false, offset: [0, -14] })
        markersRef.current.set(pos.truck_id, marker)
      }
    })

    // Supprimer les camions qui n'ont plus de données
    markersRef.current.forEach((marker, id) => {
      if (!seen.has(id)) { marker.remove(); markersRef.current.delete(id) }
    })

    // Auto-zoom uniquement si plus d'un camion actif
    const active = positions.filter(p => p.is_active !== false)
    if (active.length > 1) {
      const bounds = L.latLngBounds(active.map(p => [p.latitude, p.longitude]))
      mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 })
    } else if (active.length === 1 && positions.length === 1) {
      mapRef.current.setView([active[0].latitude, active[0].longitude], 13)
    }
  }, [positions])

  return (
    <>
      <style>{`
        @keyframes ping { 0%{transform:scale(1);opacity:.7} 75%{transform:scale(2.4);opacity:0} 100%{transform:scale(2.4);opacity:0} }
        .frigo-popup .leaflet-popup-content-wrapper { background:#18181b;border:1px solid #27272a;border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.7);padding:0 }
        .frigo-popup .leaflet-popup-content { margin:0;line-height:1.4 }
        .frigo-popup .leaflet-popup-tip-container { display:none }
        .leaflet-top,.leaflet-bottom { z-index:800 }
      `}</style>

      {/* Badge "Suivi en direct" */}
      <div style={{ position:'absolute', top:14, left:14, zIndex:1000, display:'flex', gap:8, pointerEvents:'none' }}>
        <div style={{ background:'#fff', color:'#000', padding:'6px 12px', borderRadius:999, display:'flex', alignItems:'center', gap:6, fontSize:11, fontWeight:600, boxShadow:'0 4px 16px rgba(0,0,0,.4)' }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', display:'inline-block', animation:'livePulse 2s ease-in-out infinite' }} />
          Suivi en direct
        </div>
        <div style={{ background:'rgba(24,24,27,.9)', border:'1px solid #27272a', color:'#e1f970', padding:'6px 10px', borderRadius:999, display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, backdropFilter:'blur(8px)' }}>
          {truckSvgInline('#e1f970', 12)}
          {positions.filter(p => p.is_active !== false).length} actif{positions.filter(p => p.is_active !== false).length !== 1 ? 's' : ''}
          {positions.some(p => !p.is_active) && (
            <span style={{ color:'#666', marginLeft:2 }}>· {positions.filter(p => !p.is_active).length} rangé{positions.filter(p => !p.is_active).length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {/* Bouton Refresh */}
      {onRefresh && (
        <button
          onClick={onRefresh}
          style={{ position:'absolute', top:14, right:14, zIndex:1000, width:36, height:36, background:'rgba(24,24,27,.9)', border:'1px solid #27272a', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', backdropFilter:'blur(8px)', transition:'background .15s' }}
          title="Actualiser"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function truckSvg(color: string) {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`
}

function truckSvgInline(color: string, size: number) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="2"/>
      <path d="M16 8h4l3 5v3h-7V8z"/>
      <circle cx="5.5" cy="18.5" r="2.5"/>
      <circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  )
}

function popupContent(pos: TruckPosition): string {
  const speed = pos.speed != null ? `${Math.round(pos.speed * 3.6)} km/h` : '—'
  const ago = timeAgo(pos.recorded_at)
  const isActive = pos.is_active !== false
  return `
    <div style="padding:12px 14px;min-width:175px;font-family:-apple-system,sans-serif">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <div style="width:30px;height:30px;background:${isActive ? '#e1f970' : '#3f3f3f'};border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${truckSvg(isActive ? '#000' : '#888')}
        </div>
        <div>
          <p style="font-weight:700;font-size:13px;color:#fff;margin:0;line-height:1.2">${pos.truck_name}</p>
          <p style="color:#71717a;font-size:10px;margin:0;font-family:monospace">${pos.plate_number}</p>
        </div>
        <div style="margin-left:auto">
          <span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:999px;background:${isActive ? 'rgba(225,249,112,0.15)' : 'rgba(100,100,100,0.2)'};color:${isActive ? '#e1f970' : '#888'}">
            ${isActive ? '● Actif' : '○ Rangé'}
          </span>
        </div>
      </div>
      <div style="background:#27272a;border-radius:8px;padding:8px 10px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="color:#a1a1aa;font-size:11px">Conducteur</span>
          <span style="color:#fff;font-size:11px;font-weight:600">${pos.worker_name}</span>
        </div>
      </div>
      <div style="display:flex;gap:6px">
        <div style="flex:1;background:#27272a;border-radius:8px;padding:6px 8px;text-align:center">
          <p style="color:${isActive ? '#e1f970' : '#888'};font-size:13px;font-weight:700;margin:0">${speed}</p>
          <p style="color:#71717a;font-size:9px;margin:0">vitesse</p>
        </div>
        <div style="flex:1;background:#27272a;border-radius:8px;padding:6px 8px;text-align:center">
          <p style="color:#a1a1aa;font-size:11px;font-weight:600;margin:0">${ago}</p>
          <p style="color:#71717a;font-size:9px;margin:0">dernière pos.</p>
        </div>
      </div>
    </div>
  `
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return "à l'instant"
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}j`
}
