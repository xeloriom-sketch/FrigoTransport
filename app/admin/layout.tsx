'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Truck, Users, LayoutDashboard, Snowflake, LogOut, Settings, ChevronDown, X, Loader2 } from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { href: '/admin/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/trucks/', label: 'Camions', icon: Truck },
  { href: '/admin/workers/', label: 'Ouvriers', icon: Users },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()

  const [userName, setUserName] = useState('Patron')
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId]     = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsName, setSettingsName] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const desktopRef = useRef<HTMLDivElement>(null)
  const mobileRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = 'leaflet-css'
    if (!document.getElementById(id)) {
      const link = document.createElement('link')
      link.id = id; link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserEmail(user.email ?? '')
      setUserId(user.id)
      supabase.from('profiles').select('full_name').eq('id', user.id).single()
        .then(({ data }) => {
          if (data?.full_name) { setUserName(data.full_name); setSettingsName(data.full_name) }
        })
    })
  }, [])

  // Fermer le menu en cliquant dehors — utilise "click" (pas mousedown) pour éviter
  // que le dropdown disparaisse avant que le onClick du bouton ne se déclenche
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const inDesktop = desktopRef.current?.contains(e.target as Node)
      const inMobile  = mobileRef.current?.contains(e.target as Node)
      if (!inDesktop && !inMobile) setMenuOpen(false)
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  async function handleLogout() {
    setLoggingOut(true)
    setMenuOpen(false)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch {}
    // window.location.href est plus fiable que router.push sur static export
    window.location.href = window.location.pathname.includes('/FrigoTransport')
      ? '/FrigoTransport/login/'
      : '/login/'
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault()
    if (!userId || !settingsName.trim()) return
    setSavingSettings(true)
    const supabase = createClient()
    await supabase.from('profiles').update({ full_name: settingsName.trim() }).eq('id', userId)
    setUserName(settingsName.trim())
    setSavingSettings(false)
    setShowSettings(false)
  }

  const initials = userName.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)

  function ProfileMenu() {
    return (
      <div className="absolute right-0 top-full mt-2 w-56 bg-bg-card border border-border-thin rounded-2xl shadow-2xl overflow-hidden z-[200]">
        <div className="px-4 py-3 border-b border-border-thin">
          <p className="text-sm font-semibold text-white">{userName}</p>
          <p className="text-[11px] text-txt-muted mt-0.5 truncate">{userEmail}</p>
        </div>
        <div className="p-1.5">
          <button
            onClick={() => { setMenuOpen(false); setShowSettings(true) }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-txt-muted hover:text-white hover:bg-bg-input rounded-xl transition text-left"
          >
            <Settings className="w-4 h-4 shrink-0" />
            Paramètres
          </button>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition text-left disabled:opacity-60"
          >
            {loggingOut
              ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
              : <LogOut className="w-4 h-4 shrink-0" />}
            {loggingOut ? 'Déconnexion...' : 'Se déconnecter'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-main text-white" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.01em' }}>

      {/* ── Header desktop ── */}
      <header className="hidden lg:flex items-center justify-between px-6 border-b border-border-thin header-safe">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-white rounded-md flex items-center justify-center">
              <Snowflake className="w-3 h-3 text-black" />
            </div>
            <span className="text-base font-bold tracking-tight">FrigoTransport.</span>
          </div>
          <nav className="flex items-center gap-6 text-sm font-medium">
            {nav.map(({ href, label, exact }) => {
              const active = exact
                ? pathname === href || pathname === href.slice(0, -1)
                : pathname.startsWith(href.slice(0, -1))
              return (
                <Link key={href} href={href} className={clsx('transition', active ? 'text-white' : 'text-txt-muted hover:text-white')}>
                  {label}
                </Link>
              )
            })}
          </nav>
        </div>
        <div className="relative" ref={desktopRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="flex items-center gap-2.5 bg-bg-card border border-border-thin pl-1.5 pr-3 py-1.5 rounded-full hover:bg-bg-input transition"
          >
            <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-xs font-bold text-accent">
              {initials}
            </div>
            <div className="text-left leading-none">
              <p className="text-xs font-semibold text-white">{userName.split(' ')[0]}</p>
              <p className="text-[10px] text-txt-muted">Administrateur</p>
            </div>
            <ChevronDown className={clsx('w-3.5 h-3.5 text-txt-muted transition-transform', menuOpen && 'rotate-180')} />
          </button>
          {menuOpen && <ProfileMenu />}
        </div>
      </header>

      {/* ── Header mobile ── */}
      <header className="lg:hidden flex items-center justify-between px-4 border-b border-border-thin header-safe-sm">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center">
            <Snowflake className="w-3.5 h-3.5 text-black" />
          </div>
          <span className="text-sm font-bold tracking-tight">FrigoTransport.</span>
        </div>
        <div className="relative" ref={mobileRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="w-9 h-9 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-xs font-bold text-accent"
          >
            {initials}
          </button>
          {menuOpen && <ProfileMenu />}
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="p-4 lg:p-5 pb-24 lg:pb-5 pl-safe pr-safe">
        {children}
      </main>

      {/* ── Bottom nav mobile ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg-card/95 backdrop-blur-md border-t border-border-thin"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex">
          {nav.map(({ href, label, icon: Icon, exact }) => {
            const active = exact
              ? pathname === href || pathname === href.slice(0, -1)
              : pathname.startsWith(href.slice(0, -1))
            return (
              <Link key={href} href={href}
                className={clsx('flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition',
                  active ? 'text-accent' : 'text-txt-muted')}>
                <Icon className={clsx('w-5 h-5', active ? 'text-accent' : 'text-txt-muted')} />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* ── Modal Paramètres ── */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-end sm:items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowSettings(false) }}>
          <div className="bg-bg-card border border-border-thin rounded-3xl w-full max-w-sm overflow-hidden"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>

            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border-thin">
              <h2 className="text-sm font-semibold text-white">Paramètres du profil</h2>
              <button onClick={() => setShowSettings(false)} className="p-1.5 text-txt-muted hover:text-white transition rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={saveSettings} className="p-5 space-y-4">
              {/* Email (lecture seule) */}
              <div>
                <label className="block text-[10px] text-txt-muted mb-1.5 uppercase tracking-wider">Email</label>
                <div className="w-full px-3 py-3 bg-bg-input/50 border border-border-thin rounded-xl text-txt-muted text-sm select-all">
                  {userEmail}
                </div>
              </div>

              {/* Nom complet modifiable */}
              <div>
                <label className="block text-[10px] text-txt-muted mb-1.5 uppercase tracking-wider">Nom affiché</label>
                <input
                  value={settingsName}
                  onChange={e => setSettingsName(e.target.value)}
                  required
                  className="w-full px-3 py-3 bg-bg-input border border-border-thin rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-accent/50 transition"
                />
              </div>

              <button
                type="submit"
                disabled={savingSettings || settingsName.trim() === userName}
                className="w-full py-3 bg-accent text-black text-sm font-semibold rounded-xl hover:bg-[#d2eb57] transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingSettings ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...</> : 'Enregistrer'}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full py-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium rounded-xl hover:bg-red-500/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                {loggingOut ? 'Déconnexion...' : 'Se déconnecter'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
