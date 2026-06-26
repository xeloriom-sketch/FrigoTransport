'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function TopLoader() {
  const pathname               = usePathname()
  const [progress, setProgress] = useState(0)
  const [visible,  setVisible]  = useState(false)
  const timerRef               = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevPathRef            = useRef(pathname)

  useEffect(() => {
    if (pathname === prevPathRef.current) return
    prevPathRef.current = pathname

    // Nouvelle page → démarrer la barre
    setProgress(10)
    setVisible(true)

    // Progression simulée rapide jusqu'à 85%
    let p = 10
    timerRef.current = setInterval(() => {
      p += Math.random() * 18 + 6
      if (p >= 85) { p = 85; clearInterval(timerRef.current!) }
      setProgress(p)
    }, 120)

    // Compléter après le rendu (300ms suffisent pour les pages statiques)
    const done = setTimeout(() => {
      clearInterval(timerRef.current!)
      setProgress(100)
      setTimeout(() => { setVisible(false); setProgress(0) }, 300)
    }, 350)

    return () => { clearInterval(timerRef.current!); clearTimeout(done) }
  }, [pathname])

  if (!visible) return null

  return (
    <div style={{
      position:   'fixed',
      top:        0,
      left:       0,
      right:      0,
      height:     3,
      zIndex:     99999,
      pointerEvents: 'none',
    }}>
      <div style={{
        height:     '100%',
        width:      `${progress}%`,
        background: 'linear-gradient(90deg, #e1f970, #a8e63a)',
        transition: progress === 100 ? 'width .15s ease, opacity .3s .15s' : 'width .12s ease',
        opacity:    progress === 100 ? 0 : 1,
        boxShadow:  '0 0 10px rgba(225,249,112,.7)',
        borderRadius: '0 3px 3px 0',
      }} />
    </div>
  )
}
