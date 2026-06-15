'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Truck, Users, LayoutDashboard, LogOut, Snowflake, Search, Bell, ChevronDown } from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { href: '/admin/', label: 'Overview', exact: true },
  { href: '/admin/trucks/', label: 'Camions' },
  { href: '/admin/workers/', label: 'Ouvriers' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const id = 'leaflet-css'
    if (!document.getElementById(id)) {
      const link = document.createElement('link')
      link.id = id
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login/')
  }

  return (
    <div className="min-h-screen bg-bg-main text-white" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.01em' }}>

      {/* Top Navigation */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border-thin">
        <div className="flex items-center gap-10">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-white rounded-md flex items-center justify-center">
              <Snowflake className="w-3 h-3 text-black" />
            </div>
            <span className="text-base font-bold tracking-tight">FrigoTransport.</span>
          </div>

          {/* Nav links */}
          <nav className="flex items-center gap-6 text-sm font-medium">
            {nav.map(({ href, label, exact }) => {
              const active = exact
                ? pathname === href || pathname === href.slice(0, -1)
                : pathname.startsWith(href.slice(0, -1))
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'transition',
                    active ? 'text-white' : 'text-txt-muted hover:text-white'
                  )}
                >
                  {label}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          <button className="w-9 h-9 flex items-center justify-center rounded-full border border-border-thin text-txt-muted hover:text-white hover:bg-bg-card transition">
            <Search className="w-4 h-4" />
          </button>
          <button className="w-9 h-9 flex items-center justify-center rounded-full border border-border-thin text-txt-muted hover:text-white hover:bg-bg-card transition">
            <Bell className="w-4 h-4" />
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 bg-bg-card border border-border-thin pl-3 pr-4 py-1.5 rounded-full hover:bg-bg-input transition"
          >
            <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center">
              <Truck className="w-3 h-3 text-sky-400" />
            </div>
            <div className="leading-none text-left">
              <p className="text-xs font-semibold text-white">Patron</p>
              <span className="text-[10px] text-txt-muted">Administrateur</span>
            </div>
            <ChevronDown className="w-3 h-3 text-txt-muted" />
          </button>
        </div>
      </header>

      {/* Page content */}
      <main className="p-5">
        {children}
      </main>
    </div>
  )
}
