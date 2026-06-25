'use client'

import { useEffect, useRef } from 'react'
import type { TruckPosition } from '@/types'

interface Props {
  positions: TruckPosition[]
}

export default function LiveMap({ positions }: Props) {
  const mapRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())
  const containerId = useRef(`live-map-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    const L = require('leaflet')

    if (mapRef.current) return

    mapRef.current = L.map(containerId.current, {
      center: [31.7917, -7.0926], // Maroc centre
      zoom: 6,
      zoomControl: false,
      attributionControl: false,
    })

    // Tuiles dark — CartoDB Dark Matter
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(mapRef.current)

    // Attribution discrète en bas à droite
    L.control.attribution({ prefix: false, position: 'bottomright' })
      .addAttribution('<span style="color:#444;font-size:9px">© CARTO · OSM</span>')
      .addTo(mapRef.current)

    // Zoom custom en bas à gauche
    L.control.zoom({ position: 'bottomleft' }).addTo(mapRef.current)

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markersRef.current.clear()
      }
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    const L = require('leaflet')
    const seen = new Set<string>()

    positions.forEach((pos) => {
      seen.add(pos.truck_id)
      const latlng: [number, number] = [pos.latitude, pos.longitude]
      const speed = pos.speed != null ? Math.round(pos.speed * 3.6) : 0
      const existing = markersRef.current.get(pos.truck_id)

      const iconHtml = `
        <div style="position:relative;width:36px;height:36px">
          <div style="
            position:absolute;inset:0;
            background:rgba(225,249,112,0.15);
            border-radius:50%;
            animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite;
          "></div>
          <div style="
            position:absolute;inset:4px;
            background:#e1f970;
            border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 0 12px rgba(225,249,112,0.6);
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </div>
        </div>
      `

      const icon = L.divIcon({
        className: '',
        html: iconHtml,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -20],
      })

      if (existing) {
        existing.setLatLng(latlng)
        existing.setIcon(icon)
        existing.getPopup()?.setContent(popupContent(pos))
      } else {
        const marker = L.marker(latlng, { icon })
          .addTo(mapRef.current)
          .bindPopup(popupContent(pos), {
            className: 'frigo-popup',
            closeButton: false,
            offset: [0, -10],
          })
        markersRef.current.set(pos.truck_id, marker)
      }
    })

    markersRef.current.forEach((marker, id) => {
      if (!seen.has(id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    })

    if (positions.length === 1) {
      mapRef.current.setView([positions[0].latitude, positions[0].longitude], 13)
    } else if (positions.length > 1) {
      const bounds = L.latLngBounds(positions.map(p => [p.latitude, p.longitude]))
      mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 })
    }
  }, [positions])

  return (
    <>
      <style>{`
        @keyframes ping {
          0%   { transform: scale(1);   opacity: .6; }
          75%  { transform: scale(2.2); opacity: 0;  }
          100% { transform: scale(2.2); opacity: 0;  }
        }
        .frigo-popup .leaflet-popup-content-wrapper {
          background: #18181b;
          border: 1px solid #27272a;
          border-radius: 14px;
          box-shadow: 0 8px 32px rgba(0,0,0,.6);
          padding: 0;
        }
        .frigo-popup .leaflet-popup-content {
          margin: 0;
          line-height: 1.4;
        }
        .frigo-popup .leaflet-popup-tip-container { display:none; }
        /* override leaflet z-index on controls to keep them above tiles */
        .leaflet-top, .leaflet-bottom { z-index: 800; }
      `}</style>

      {/* Overlay badges — z-index > 1000 pour passer au-dessus de Leaflet */}
      <div style={{
        position: 'absolute', top: 14, left: 14,
        zIndex: 1000, display: 'flex', gap: 8, pointerEvents: 'none',
      }}>
        <div style={{
          background: '#fff', color: '#000',
          padding: '6px 12px', borderRadius: 999,
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,.4)',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'ping2 2s ease-in-out infinite' }} />
          Suivi en direct
        </div>
        <div style={{
          background: 'rgba(24,24,27,.9)', border: '1px solid #27272a',
          color: '#e1f970', padding: '6px 10px', borderRadius: 999,
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 11, fontWeight: 600,
          backdropFilter: 'blur(8px)',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
          {positions.length} camion{positions.length !== 1 ? 's' : ''}
        </div>
      </div>

      <style>{`
        @keyframes ping2 {
          0%, 100% { opacity: 1; }
          50% { opacity: .4; }
        }
      `}</style>

      <div id={containerId.current} style={{ width: '100%', height: '100%' }} />
    </>
  )
}

function popupContent(pos: TruckPosition): string {
  const speed = pos.speed != null ? `${Math.round(pos.speed * 3.6)} km/h` : '—'
  const ago = timeAgo(pos.recorded_at)
  return `
    <div style="padding:12px 14px;min-width:170px;font-family:-apple-system,sans-serif">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <div style="width:28px;height:28px;background:#e1f970;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
        </div>
        <div>
          <p style="font-weight:700;font-size:13px;color:#fff;margin:0;line-height:1.2">${pos.truck_name}</p>
          <p style="color:#71717a;font-size:10px;margin:0;font-family:monospace">${pos.plate_number}</p>
        </div>
      </div>
      <div style="background:#27272a;border-radius:8px;padding:8px 10px;display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="color:#a1a1aa;font-size:11px">Ouvrier</span>
        <span style="color:#fff;font-size:11px;font-weight:600">${pos.worker_name}</span>
      </div>
      <div style="display:flex;gap:6px">
        <div style="flex:1;background:#27272a;border-radius:8px;padding:6px 8px;text-align:center">
          <p style="color:#e1f970;font-size:13px;font-weight:700;margin:0">${speed}</p>
          <p style="color:#71717a;font-size:9px;margin:0">vitesse</p>
        </div>
        <div style="flex:1;background:#27272a;border-radius:8px;padding:6px 8px;text-align:center">
          <p style="color:#a1a1aa;font-size:11px;font-weight:600;margin:0">${ago}</p>
          <p style="color:#71717a;font-size:9px;margin:0">mis à jour</p>
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
  return `${Math.floor(m / 60)}h`
}
