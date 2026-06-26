'use client'

import { Component, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'

interface Props  { children: ReactNode }
interface State  { crashed: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false }

  static getDerivedStateFromError() {
    return { crashed: true }
  }

  componentDidCatch(err: Error) {
    console.error('[FrigoTransport] Erreur fatale:', err)
    // Si le fichier JS vient d'un vieux cache SW, forcer le rechargement
    if (err.message?.includes('chunk') || err.message?.includes('Loading')) {
      clearSWCache().then(() => window.location.reload())
    }
  }

  render() {
    if (this.state.crashed) {
      return (
        <div style={{
          minHeight: '100vh', background: '#020817', color: '#fff',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center',
          fontFamily: 'Inter, sans-serif',
        }}>
          <div style={{ width: 56, height: 56, background: '#1e293b', borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RefreshCw size={24} color="#94a3b8" />
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 16, margin: '0 0 6px' }}>L'app a planté</p>
            <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
              Probablement un cache obsolète. Rechargez pour corriger.
            </p>
          </div>
          <button
            onClick={() => clearSWCache().then(() => window.location.reload())}
            style={{ padding: '12px 28px', background: '#e1f970', color: '#000',
              border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            Recharger l'app
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

async function clearSWCache() {
  try {
    const keys = await caches.keys()
    await Promise.all(keys.map(k => caches.delete(k)))
    const regs = await navigator.serviceWorker?.getRegistrations() ?? []
    await Promise.all(regs.map(r => r.unregister()))
  } catch {}
}
