'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, X, Sparkles } from 'lucide-react'

// ⬆️ INCRÉMENTER ICI à chaque déploiement + mettre à jour CHANGELOG
const APP_VERSION = '1.8.0'
const CHANGELOG = [
  'Google Maps intégré — rues, restaurants, POIs en temps réel',
  'Marqueur camion corrigé — s\'affiche au bon endroit sur la carte',
  'Adresse dans la popup — affichée automatiquement au clic',
  'Écran anti-veille — l\'app reste allumée comme YouTube',
  'Historique des trajets avec polyline colorée par vitesse',
  'Flèche camion tourne dans la direction de déplacement',
]

export default function PWAUpdater() {
  const [updateReady, setUpdateReady] = useState(false)
  const [showChangelog, setShowChangelog] = useState(false)
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    // Afficher le changelog si nouvelle version détectée
    const lastVersion = localStorage.getItem('app-version')
    if (lastVersion !== APP_VERSION) {
      // Délai pour laisser l'app se charger
      setTimeout(() => setShowChangelog(true), 1500)
      localStorage.setItem('app-version', APP_VERSION)
    }

    // Enregistrer le service worker
    navigator.serviceWorker.register('/FrigoTransport/sw.js', { scope: '/FrigoTransport/' })
      .then(registration => {
        setReg(registration)

        // Mise à jour déjà en attente (rechargement précédent)
        if (registration.waiting) {
          setUpdateReady(true)
        }

        // Nouvelle mise à jour détectée pendant la session
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateReady(true)
            }
          })
        })

        // Forcer la vérification d'une mise à jour à chaque chargement
        registration.update().catch(() => {})
      })
      .catch(() => {})

    // Recharger automatiquement quand le nouveau SW prend le contrôle
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload()
    })
  }, [])

  function applyUpdate() {
    if (reg?.waiting) {
      reg.waiting.postMessage('SKIP_WAITING')
    } else {
      window.location.reload()
    }
  }

  if (!updateReady && !showChangelog) return null

  return (
    <>
      {/* Bannière mise à jour disponible */}
      {updateReady && (
        <div className="fixed top-4 left-4 right-4 z-[9999] flex items-center gap-3 bg-accent text-black rounded-2xl p-3.5 shadow-2xl">
          <RefreshCw className="w-5 h-5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-tight">Mise à jour disponible</p>
            <p className="text-xs opacity-70 mt-0.5">Rechargez pour obtenir la dernière version</p>
          </div>
          <button
            onClick={applyUpdate}
            className="px-3 py-1.5 bg-black/15 hover:bg-black/25 text-black text-xs font-bold rounded-xl transition shrink-0"
          >
            Mettre à jour
          </button>
          <button onClick={() => setUpdateReady(false)} className="p-1 opacity-60 hover:opacity-100 transition shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modal nouveautés */}
      {showChangelog && !updateReady && (
        <div className="fixed inset-0 bg-black/70 z-[9998] flex items-end sm:items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowChangelog(false) }}>
          <div className="bg-bg-card border border-border-thin rounded-3xl w-full max-w-sm overflow-hidden"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>

            {/* En-tête gradient */}
            <div className="relative overflow-hidden px-5 pt-6 pb-5">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/8 to-transparent pointer-events-none" />
              <div className="relative flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-accent rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
                    style={{ boxShadow: '0 0 20px rgba(225,249,112,0.3)' }}>
                    <Sparkles className="w-6 h-6 text-black" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-bold text-base">Nouveautés</p>
                      <span className="bg-accent/20 border border-accent/30 text-accent text-[10px] font-bold px-2 py-0.5 rounded-full">
                        v{APP_VERSION}
                      </span>
                    </div>
                    <p className="text-txt-muted text-xs mt-0.5">
                      FrigoTransport · {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowChangelog(false)}
                  className="p-1.5 text-txt-muted hover:text-white transition rounded-xl hover:bg-bg-input shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Liste des nouveautés */}
            <div className="px-5 pb-2 space-y-1">
              {CHANGELOG.map((item, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-border-thin last:border-0">
                  <div className="w-5 h-5 bg-accent/15 rounded-md flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-accent text-[10px] font-bold">{i + 1}</span>
                  </div>
                  <p className="text-white/85 text-sm leading-snug">{item}</p>
                </div>
              ))}
            </div>

            {/* Bouton */}
            <div className="p-5 pt-3">
              <button
                onClick={() => setShowChangelog(false)}
                className="w-full py-3.5 bg-accent text-black text-sm font-bold rounded-2xl hover:bg-[#d2eb57] active:scale-[0.98] transition"
                style={{ boxShadow: '0 0 20px rgba(225,249,112,0.2)' }}
              >
                Parfait, merci ! 🎉
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
