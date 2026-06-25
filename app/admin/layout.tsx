'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Truck, Users, LayoutDashboard, Snowflake, LogOut, Settings, ChevronDown, User } from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { href: '/admin/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/trucks/', label: 'Camions', icon: Truck },
  { href: '/admin/workers/', label: 'Ouvriers', icon: Users },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [userName, setUserName] = useState('Patron')
  const [userEmail, setUserEmail] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = 'leaflet-css'
    if (!document.getElementById(id)) {
      const link = document.createElement('link')
      link.id = id
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    // Récupérer les infos utilisateur
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserEmail(user.email ?? '')
      supabase.from('profiles').select('full_name').eq('id', user.id).single()
        .then(({ data }) => { if (data?.full_name) setUserName(data.full_name) })
    })
  }, [])

  // Fermer le menu en cliquant en dehors
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login/')
  }

  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="min-h-screen bg-bg-main text-white" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.01em' }}>

      {/* ── Header desktop ── */}
      <header className="hidden lg:flex items-center justify-between px-6 py-3 border-b border-border-thin">
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

        {/* Menu profil desktop */}
        <div className="relative" ref={menuRef}>
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

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-bg-card border border-border-thin rounded-2xl shadow-2xl overflow-hidden z-50">
              {/* Info utilisateur */}
              <div className="px-4 py-3 border-b border-border-thin">
                <p className="text-sm font-semibold text-white">{userName}</p>
                <p className="text-[11px] text-txt-muted mt-0.5 truncate">{userEmail}</p>
              </div>
              {/* Actions */}
              <div className="p-1.5">
                <button
                  onClick={() => { setMenuOpen(false); alert('Paramètres profil — à implémenter') }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-txt-muted hover:text-white hover:bg-bg-input rounded-xl transition text-left"
                >
                  <Settings className="w-4 h-4 shrink-0" />
                  Paramètres
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition text-left"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  Se déconnecter
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── Header mobile ── */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border-thin">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center">
            <Snowflake className="w-3.5 h-3.5 text-black" />
          </div>
          <span className="text-sm font-bold tracking-tight">FrigoTransport.</span>
        </div>

        {/* Avatar mobile cliquable */}
        <div className="relative" ref={undefined}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="w-9 h-9 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-xs font-bold text-accent"
          >
            {initials}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-bg-card border border-border-thin rounded-2xl shadow-2xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-border-thin">
                <p className="text-sm font-semibold text-white">{userName}</p>
                <p className="text-[11px] text-txt-muted mt-0.5 truncate">{userEmail}</p>
              </div>
              <div className="p-1.5">
                <button
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-txt-muted hover:text-white hover:bg-bg-input rounded-xl transition text-left"
                >
                  <Settings className="w-4 h-4 shrink-0" />
                  Paramètres
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition text-left"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  Se déconnecter
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="p-4 lg:p-5 pb-24 lg:pb-5">
        {children}
      </main>

      {/* ── Bottom nav (mobile only) ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg-card/95 backdrop-blur-md border-t border-border-thin"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex">
          {nav.map(({ href, label, icon: Icon, exact }) => {
            const active = exact
              ? pathname === href || pathname === href.slice(0, -1)
              : pathname.startsWith(href.slice(0, -1))
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition',
                  active ? 'text-accent' : 'text-txt-muted'
                )}
              >
                <Icon className={clsx('w-5 h-5', active ? 'text-accent' : 'text-txt-muted')} />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>

    </div>
  )
}
