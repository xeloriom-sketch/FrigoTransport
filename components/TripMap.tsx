'use client'

import { useEffect, useRef } from 'react'
import type { Location } from '@/types'

interface Props {
  points: Location[]
}

export default function TripMap({ points }: Props) {
  const containerId = useRef(`trip-map-${Math.random().toString(36).slice(2)}`)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    const L = require('leaflet')
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }

    if (points.length === 0) return

    mapRef.current = L.map(containerId.current, {
      zoomControl: false,
      attributionControl: true,
    })

    L.control.zoom({ position: 'bottomleft' }).addTo(mapRef.current)

    const loadScript = (src: string, readyCheck: () => boolean) => new Promise<void>((res, rej) => {
      if (readyCheck()) { res(); return }
      const existing = document.querySelector(`script[src*="${src.split('?')[0].split('/').pop()}"]`) as HTMLScriptElement | null
      if (existing) {
        existing.addEventListener('load', () => res())
        existing.addEventListener('error', () => rej())
        return
      }
      const s = document.createElement('script')
      s.src = src; s.onload = () => res(); s.onerror = () => rej()
      document.head.appendChild(s)
    });

    (async () => {
      try {
        const key = 'AIzaSyBplAYmn_oV0dMR4ZcZr0ZeTXFvMxZmVrU'
        await loadScript(
          `https://maps.googleapis.com/maps/api/js?key=${key}`,
          () => !!(window as any).google?.maps?.Map
        )
        await loadScript(
          'https://unpkg.com/leaflet.gridlayer.googlemutant@0.13.5/dist/Leaflet.GoogleMutant.js',
          () => !!(L as any).gridLayer?.googleMutant
        )
        if (!mapRef.current) return
        ;(L as any).gridLayer.googleMutant({ type: 'roadmap', maxZoom: 22 }).addTo(mapRef.current)
      } catch {
        if (!mapRef.current) return
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          maxZoom: 20, subdomains: 'abcd',
        }).addTo(mapRef.current)
      }
    })()

    // ── Dessiner le trajet avec segments colorés par vitesse ─────────────
    const validPts = points.filter(p => !(Math.abs(p.latitude) < 0.001 && Math.abs(p.longitude) < 0.001))
    if (validPts.length === 0) return

    let segStart = 0
    for (let i = 1; i <= validPts.length; i++) {
      const prev  = validPts[i - 1]
      const cur   = validPts[i]
      const speedKmh = (prev.speed ?? 0) * 3.6
      const color = speedKmh > 90 ? '#ef4444' : speedKmh > 70 ? '#f97316' : '#16a34a'
      const nextSpeedKmh = cur ? (cur.speed ?? 0) * 3.6 : -1
      const nextColor = nextSpeedKmh > 90 ? '#ef4444' : nextSpeedKmh > 70 ? '#f97316' : '#16a34a'

      if (i === validPts.length || nextColor !== color) {
        const seg = validPts.slice(segStart, i).map(p => [p.latitude, p.longitude] as [number, number])
        L.polyline(seg, {
          color,
          weight:    5,
          opacity:   0.85,
          lineJoin:  'round',
          lineCap:   'round',
        }).addTo(mapRef.current)
        segStart = i - 1
      }
    }

    // ── Points cliquables (1 tous les ~5 points pour ne pas surcharger) ──
    validPts.forEach((p, i) => {
      if (i % 5 !== 0 && i !== validPts.length - 1 && i !== 0) return
      const speedKmh = p.speed != null ? Math.round(p.speed * 3.6) : null
      const time = new Date(p.recorded_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      const isFirst = i === 0
      const isLast  = i === validPts.length - 1

      if (isFirst || isLast) {
        // Marqueur début / fin
        const html = isFirst
          ? `<div style="width:32px;height:32px;background:#16a34a;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 10px rgba(22,163,74,.5);font-size:14px">🟢</div>`
          : `<div style="width:32px;height:32px;background:#ef4444;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 10px rgba(239,68,68,.5);font-size:14px">🔴</div>`
        const icon = L.divIcon({ className: '', html, iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -20] })
        L.marker([p.latitude, p.longitude], { icon })
          .addTo(mapRef.current)
          .bindPopup(popupHtml(p, isFirst ? 'Départ' : 'Arrivée', time, speedKmh), { className: 'trip-popup', closeButton: false })
      } else {
        // Cercle interactif
        L.circleMarker([p.latitude, p.longitude], {
          radius:      5,
          fillColor:   '#fff',
          color:       '#16a34a',
          weight:      2,
          fillOpacity: 1,
        }).addTo(mapRef.current)
          .bindPopup(popupHtml(p, null, time, speedKmh), { className: 'trip-popup', closeButton: false })
      }
    })

    // ── Zoom sur le trajet ────────────────────────────────────────────────
    const bounds = L.latLngBounds(validPts.map(p => [p.latitude, p.longitude]))
    mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [points])

  return (
    <>
      <style>{`
        .trip-popup .leaflet-popup-content-wrapper {
          background:#fff;border-radius:12px;
          box-shadow:0 4px 20px rgba(0,0,0,.15);padding:0;border:none;
        }
        .trip-popup .leaflet-popup-content { margin:0 }
        .trip-popup .leaflet-popup-tip { background:#fff }
        .leaflet-top,.leaflet-bottom { z-index:800 }
      `}</style>
      <div id={containerId.current} style={{ width: '100%', height: '100%' }} />
    </>
  )
}

function popupHtml(p: Location, label: string | null, time: string, speedKmh: number | null) {
  const acc = p.accuracy != null ? `${Math.round(p.accuracy)} m` : '—'
  return `<div style="padding:10px 13px;min-width:155px;font-family:-apple-system,sans-serif">
    ${label ? `<p style="font-weight:700;font-size:12px;color:#0f172a;margin:0 0 6px">${label}</p>` : ''}
    <div style="display:flex;gap:8px">
      <div style="flex:1;text-align:center;background:#f8fafc;border-radius:8px;padding:5px">
        <p style="color:#16a34a;font-size:13px;font-weight:700;margin:0">${speedKmh != null ? speedKmh + ' km/h' : '—'}</p>
        <p style="color:#94a3b8;font-size:9px;margin:1px 0 0;text-transform:uppercase;letter-spacing:.4px">vitesse</p>
      </div>
      <div style="flex:1;text-align:center;background:#f8fafc;border-radius:8px;padding:5px">
        <p style="color:#475569;font-size:11px;font-weight:600;margin:0">${time}</p>
        <p style="color:#94a3b8;font-size:9px;margin:1px 0 0;text-transform:uppercase;letter-spacing:.4px">heure</p>
      </div>
    </div>
    <p style="color:#94a3b8;font-size:9px;margin:5px 0 0;text-align:center">Précision GPS : ${acc}</p>
  </div>`
}
