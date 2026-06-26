'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, X, Sparkles } from 'lucide-react'

// Incrémenter cette version à chaque déploiement important
const APP_VERSION = '1.3.0'
const CHANGELOG = [
  'Scanner QR intégré (plus besoin de l\'appli caméra)',
  'Dashboard responsive mobile avec bottom nav',
  'Carte GPS personnalisée en mode sombre',
  'Bouton installation bureau iOS/Android',
  'Déconnexion et paramètres profil corrigés',
]

export default function PWAUpdater() {
  const [updateReady, setUpdateReady] = useState(false)
  const [showChangelog, setShowChangelog] = useState(false)
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    // Vérifier si c'est une nouvelle version
    const lastVersion = localStorage.getItem('app-version')
    if (lastVersion && lastVersion !== APP_VERSION) {
      setShowChangelog(true)
    }
    localStorage.setItem('app-version', APP_VERSION)

    // Enregistrer le service worker
    navigator.serviceWorker.register('/FrigoTransport/sw.js', { scope: '/FrigoTransport/' })
      .then(registration => {
        setReg(registration)

        // Détecter une mise à jour en attente
        if (registration.waiting) {
          setUpdateReady(true)
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateReady(true)
            }
          })
        })
      })
      .catch(() => {})

    // Recharger quand le nouveau SW prend le contrôle
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

      {/* Modal nouveautés (à la première ouverture après mise à jour) */}
      {showChangelog && !updateReady && (
        <div className="fixed inset-0 bg-black/60 z-[9998] flex items-end sm:items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowChangelog(false) }}>
          <div className="bg-bg-card border border-border-thin rounded-3xl w-full max-w-sm overflow-hidden"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-accent/20 border border-accent/30 rounded-2xl flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">Mise à jour v{APP_VERSION}</p>
                  <p className="text-txt-muted text-xs">FrigoTransport</p>
                </div>
              </div>

              <div className="space-y-2 mb-5">
                {CHANGELOG.map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="text-accent text-xs mt-0.5 shrink-0">✦</span>
                    <p className="text-white/80 text-sm leading-snug">{item}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowChangelog(false)}
                className="w-full py-3 bg-accent text-black text-sm font-bold rounded-xl hover:bg-[#d2eb57] transition"
              >
                Super, merci !
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
