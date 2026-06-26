'use client'

import { useEffect, useRef } from 'react'
import type { TruckPosition } from '@/types'

interface Props { positions: TruckPosition[] }

const SILENT_MS   = 30 * 60 * 1000  // 30 minutes sans signal
const CHECK_MS    = 3 * 60 * 1000   // vérifier toutes les 3 min
const alerted     = new Set<string>() // trucksId déjà notifiés

export default function GPSAlertMonitor({ positions }: Props) {
  const posRef = useRef(positions)
  posRef.current = positions

  useEffect(() => {
    // Demander la permission une fois
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    const check = () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return
      const now = Date.now()

      posRef.current.forEach(pos => {
        if (pos.is_active === false) return  // seulement les camions en service
        const age    = now - new Date(pos.recorded_at).getTime()
        const bucket = Math.floor(age / SILENT_MS)  // 1 alerte par tranche de 30 min
        const key    = `${pos.truck_id}-${bucket}`

        if (age >= SILENT_MS && !alerted.has(key)) {
          alerted.add(key)
          const mins = Math.round(age / 60_000)

          new Notification(`⚠️ ${pos.truck_name} — Aucun signal GPS`, {
            body:  `${pos.worker_name} n'a pas transmis depuis ${mins} min. Vérifiez que l'écran reste allumé.`,
            icon:  '/FrigoTransport/icon-192.png',
            tag:   `gps-silent-${pos.truck_id}`,
          } as NotificationOptions)
        }

        // Réinitialiser quand le camion retrouve un signal
        if (age < SILENT_MS) {
          ;[...alerted].filter(k => k.startsWith(pos.truck_id)).forEach(k => alerted.delete(k))
        }
      })
    }

    const iv = setInterval(check, CHECK_MS)
    // Premier check après 1 min (laisser les données charger)
    const t  = setTimeout(check, 60_000)
    return () => { clearInterval(iv); clearTimeout(t) }
  }, [])

  return null
}
