'use client'

import { useEffect, useRef } from 'react'
import type { TruckPosition } from '@/types'

interface Props {
  positions: TruckPosition[]
}

export default function LiveMap({ positions }: Props) {
  const mapRef = useRef<any>(null)
  const containerId = 'live-map'
  const markersRef = useRef<Map<string, any>>(new Map())

  useEffect(() => {
    // Leaflet ne fonctionne que côté client
    const L = require('leaflet')

    // Fix icônes Leaflet avec webpack
    delete L.Icon.Default.prototype._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })

    if (!mapRef.current) {
      mapRef.current = L.map(containerId, {
        center: [46.8, 2.3], // France
        zoom: 6,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(mapRef.current)
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markersRef.current.clear()
      }
    }
  }, [])

  // Mettre à jour les marqueurs quand les positions changent
  useEffect(() => {
    if (!mapRef.current) return
    const L = require('leaflet')

    const seen = new Set<string>()

    positions.forEach((pos) => {
      seen.add(pos.truck_id)
      const latlng: [number, number] = [pos.latitude, pos.longitude]

      const existing = markersRef.current.get(pos.truck_id)

      if (existing) {
        existing.setLatLng(latlng)
        existing.getPopup()?.setContent(popupContent(pos))
      } else {
        const icon = L.divIcon({
          className: '',
          html: `<div style="
            background:#0ea5e9;
            border:3px solid white;
            border-radius:50%;
            width:16px;height:16px;
            box-shadow:0 2px 8px rgba(14,165,233,0.5);
          "></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        })

        const marker = L.marker(latlng, { icon })
          .addTo(mapRef.current)
          .bindPopup(popupContent(pos))

        markersRef.current.set(pos.truck_id, marker)
      }
    })

    // Supprimer les marqueurs des camions plus actifs
    markersRef.current.forEach((marker, id) => {
      if (!seen.has(id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    })

    // Auto-zoom si des positions existent
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions.map(p => [p.latitude, p.longitude]))
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 })
    }
  }, [positions])

  return <div id={containerId} className="w-full h-full rounded-xl" />
}

function popupContent(pos: TruckPosition): string {
  const ago = timeAgo(pos.recorded_at)
  const speed = pos.speed != null ? `${Math.round(pos.speed * 3.6)} km/h` : '—'
  return `
    <div style="min-width:160px;font-family:sans-serif">
      <p style="font-weight:600;font-size:14px;margin:0 0 4px">${pos.truck_name}</p>
      <p style="color:#64748b;font-size:12px;margin:0 0 2px">${pos.plate_number}</p>
      <p style="font-size:12px;margin:0 0 2px">👷 ${pos.worker_name}</p>
      <p style="font-size:12px;margin:0 0 2px">🚀 ${speed}</p>
      <p style="color:#94a3b8;font-size:11px;margin:4px 0 0">Mis à jour ${ago}</p>
    </div>
  `
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return "à l'instant"
  if (m < 60) return `il y a ${m}min`
  return `il y a ${Math.floor(m / 60)}h`
}
