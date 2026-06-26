'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, ChevronRight, ChevronLeft, Sparkles, Check } from 'lucide-react'

export interface TutorialStep {
  emoji:  string
  title:  string
  text:   string
  target?: string   // sélecteur CSS de l'élément à mettre en valeur
  color?: string    // couleur accent
}

interface Props {
  steps:      TutorialStep[]
  storageKey: string
  onDone?:    () => void
}

export default function Tutorial({ steps, storageKey, onDone }: Props) {
  const [idx,     setIdx]     = useState(0)
  const [visible, setVisible] = useState(false)
  const [rect,    setRect]    = useState<DOMRect | null>(null)
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(storageKey)) return
    const t = setTimeout(() => { setVisible(true); setTimeout(() => setEntered(true), 50) }, 900)
    return () => clearTimeout(t)
  }, [storageKey])

  // Déclenchement manuel via événement (bouton "Revoir le tutoriel")
  useEffect(() => {
    const handler = () => {
      localStorage.removeItem(storageKey)
      setIdx(0)
      setRect(null)
      setVisible(true)
      setTimeout(() => setEntered(true), 50)
    }
    window.addEventListener(`tutorial-reset:${storageKey}`, handler)
    return () => window.removeEventListener(`tutorial-reset:${storageKey}`, handler)
  }, [storageKey])

  // Mettre en valeur l'élément cible (supporte plusieurs sélecteurs séparés par virgule)
  useEffect(() => {
    if (!visible) return
    const sel = steps[idx]?.target
    if (!sel) { setRect(null); return }
    // Cherche le premier élément visible parmi les sélecteurs
    const candidates = sel.split(',').map(s => s.trim())
    let el: HTMLElement | null = null
    for (const s of candidates) {
      const found = document.querySelector(s) as HTMLElement | null
      if (found && found.offsetParent !== null) { el = found; break }
    }
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setTimeout(() => setRect(el!.getBoundingClientRect()), 400)
    } else {
      setRect(null)
    }
  }, [idx, visible, steps])

  const done = useCallback(() => {
    localStorage.setItem(storageKey, '1')
    window.dispatchEvent(new Event('tutorial-completed'))
    setEntered(false)
    setTimeout(() => { setVisible(false); onDone?.() }, 250)
  }, [storageKey, onDone])

  const next = () => idx < steps.length - 1 ? setIdx(i => i + 1) : done()
  const prev = () => idx > 0 && setIdx(i => i - 1)

  if (!visible) return null

  const step  = steps[idx]
  const color = step.color ?? '#e1f970'
  const PAD   = 10

  return (
    <>
      <style>{`
        @keyframes tutPulse {
          0%,100% { box-shadow:0 0 0 0 rgba(225,249,112,.4), 0 0 0 4px rgba(225,249,112,.1) }
          50%      { box-shadow:0 0 0 8px rgba(225,249,112,0), 0 0 0 4px rgba(225,249,112,.2) }
        }
        @keyframes tutFadeIn { from{opacity:0} to{opacity:1} }
        @keyframes tutSlide  { from{transform:translateY(32px) scale(.96);opacity:0} to{transform:translateY(0) scale(1);opacity:1} }
      `}</style>

      {/* Overlay sombre */}
      <div
        onClick={done}
        style={{
          position: 'fixed', inset: 0, zIndex: 99990,
          background: 'rgba(0,0,0,.72)',
          transition: 'opacity .25s',
          opacity: entered ? 1 : 0,
        }}
      />

      {/* Spotlight sur l'élément cible */}
      {rect && (
        <div style={{
          position: 'fixed',
          top:    rect.top    - PAD,
          left:   rect.left   - PAD,
          width:  rect.width  + PAD * 2,
          height: rect.height + PAD * 2,
          borderRadius: 14,
          border: `2px solid ${color}`,
          boxShadow: `0 0 0 9999px rgba(0,0,0,.72), 0 0 24px ${color}44`,
          zIndex: 99991,
          pointerEvents: 'none',
          animation: 'tutPulse 2s ease-in-out infinite',
          transition: 'all .35s ease',
        }} />
      )}

      {/* Carte tutoriel */}
      <div style={{
        position: 'fixed',
        bottom: 24,
        left:   16,
        right:  16,
        zIndex: 99992,
        background: '#18181b',
        border: '1px solid #27272a',
        borderRadius: 24,
        padding: '22px 20px 20px',
        boxShadow: '0 32px 80px rgba(0,0,0,.9)',
        animation: entered ? 'tutSlide .3s cubic-bezier(.22,1,.36,1)' : 'none',
        transition: 'opacity .25s',
        opacity: entered ? 1 : 0,
      }}>
        {/* Barre de progression */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 18 }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 99,
              background: i <= idx ? color : '#3f3f46',
              transition: 'background .3s',
            }} />
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, flexShrink: 0,
            background: `${color}18`, border: `1px solid ${color}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24,
          }}>
            {step.emoji}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: 16, color: '#fff', margin: '0 0 4px', lineHeight: 1.2 }}>
              {step.title}
            </p>
            <p style={{ fontSize: 13, color: '#a1a1aa', margin: 0, lineHeight: 1.5 }}>
              {step.text}
            </p>
          </div>
        </div>

        {/* Boutons navigation */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {idx > 0 && (
            <button onClick={prev} style={{
              width: 42, height: 42, borderRadius: 12, border: '1px solid #27272a',
              background: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ChevronLeft size={18} color="#71717a" />
            </button>
          )}

          <button onClick={next} style={{
            flex: 1, height: 44, borderRadius: 14,
            background: color, color: '#000', border: 'none',
            fontWeight: 700, fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            boxShadow: `0 0 20px ${color}33`,
          }}>
            {idx < steps.length - 1 ? (
              <><span>Suivant</span><ChevronRight size={16} /></>
            ) : (
              <><Check size={16} /><span>Commencer !</span></>
            )}
          </button>

          <button onClick={done} style={{
            width: 42, height: 42, borderRadius: 12, border: '1px solid #27272a',
            background: 'transparent', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={16} color="#71717a" />
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: 10, color: '#52525b', margin: '10px 0 0' }}>
          {idx + 1} / {steps.length} · Toucher ailleurs pour ignorer
        </p>
      </div>
    </>
  )
}
