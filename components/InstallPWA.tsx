'use client'

import { useEffect, useState } from 'react'
import { Download, X, Share, ArrowUpFromLine } from 'lucide-react'

export default function InstallPWA() {
  const [canInstall, setCanInstall] = useState(false)       // Android/Chrome
  const [isIOS, setIsIOS] = useState(false)                 // iOS Safari
  const [showIOSModal, setShowIOSModal] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [prompt, setPrompt] = useState<any>(null)

  useEffect(() => {
    // Déjà installée en mode standalone → cacher
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    if (isStandalone) { setInstalled(true); return }

    // Déjà ignoré par l'utilisateur dans cette session
    if (sessionStorage.getItem('pwa-dismissed')) { setDismissed(true); return }

    // Détection iOS (Safari ne supporte pas beforeinstallprompt)
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(ios)

    // Android / Chrome : écoute l'event natif
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e)
      setCanInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Si iOS et pas standalone → on peut afficher le bouton
    if (ios) setCanInstall(true)

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (installed || dismissed || (!canInstall && !isIOS)) return null

  async function handleInstall() {
    if (isIOS) {
      setShowIOSModal(true)
      return
    }
    if (prompt) {
      prompt.prompt()
      const { outcome } = await prompt.userChoice
      if (outcome === 'accepted') setInstalled(true)
      setPrompt(null)
      setCanInstall(false)
    }
  }

  function dismiss() {
    sessionStorage.setItem('pwa-dismissed', '1')
    setDismissed(true)
    setShowIOSModal(false)
  }

  return (
    <>
      {/* Bannière d'installation */}
      <div className="fixed bottom-6 left-4 right-4 z-[9999] flex items-center gap-3 bg-bg-card border border-border-thin rounded-2xl p-3.5 shadow-2xl"
        style={{ backdropFilter: 'blur(12px)' }}>
        {/* Icône app */}
        <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0 border border-border-thin">
          <img src="/FrigoTransport/icon-192.png" alt="FrigoTransport" className="w-full h-full object-cover" />
        </div>

        {/* Texte */}
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold leading-tight">Installer l'app</p>
          <p className="text-txt-muted text-xs mt-0.5">Accès rapide depuis votre bureau</p>
        </div>

        {/* Bouton installer */}
        <button
          onClick={handleInstall}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-accent text-black text-xs font-bold rounded-xl hover:bg-[#d2eb57] active:scale-95 transition shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Installer
        </button>

        {/* Fermer */}
        <button
          onClick={dismiss}
          className="p-1.5 text-txt-muted hover:text-white transition shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Modal iOS — instructions */}
      {showIOSModal && (
        <div className="fixed inset-0 bg-black/70 z-[99999] flex items-end justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowIOSModal(false) }}>
          <div className="bg-bg-card border border-border-thin rounded-3xl w-full max-w-sm overflow-hidden"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border-thin">
              <div className="flex items-center gap-3">
                <img src="/FrigoTransport/icon-192.png" alt="" className="w-10 h-10 rounded-xl border border-border-thin" />
                <div>
                  <p className="text-white font-semibold text-sm">FrigoTransport</p>
                  <p className="text-txt-muted text-xs">Ajouter à l'écran d'accueil</p>
                </div>
              </div>
              <button onClick={() => setShowIOSModal(false)} className="p-1.5 text-txt-muted hover:text-white transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Étapes iOS */}
            <div className="p-5 space-y-4">
              {[
                {
                  icon: <Share className="w-5 h-5 text-blue-400" />,
                  bg: 'bg-blue-500/15',
                  step: '1',
                  title: 'Appuyez sur Partager',
                  desc: "Icône carré avec flèche ↑ en bas de Safari",
                },
                {
                  icon: <ArrowUpFromLine className="w-5 h-5 text-accent" />,
                  bg: 'bg-accent/10',
                  step: '2',
                  title: '"Sur l\'écran d\'accueil"',
                  desc: 'Faites défiler le menu vers le bas',
                },
                {
                  icon: <Download className="w-5 h-5 text-emerald-400" />,
                  bg: 'bg-emerald-500/15',
                  step: '3',
                  title: 'Appuyez sur "Ajouter"',
                  desc: "L'app apparaît sur votre bureau",
                },
              ].map(({ icon, bg, step, title, desc }) => (
                <div key={step} className="flex items-center gap-4">
                  <div className={`w-12 h-12 ${bg} rounded-2xl flex items-center justify-center shrink-0`}>
                    {icon}
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">{title}</p>
                    <p className="text-txt-muted text-xs mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 pb-2">
              <button
                onClick={dismiss}
                className="w-full py-3 bg-bg-input border border-border-thin text-txt-muted text-sm rounded-xl hover:text-white transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
