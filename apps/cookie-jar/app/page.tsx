'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  IconCookie,
  IconPlus,
  IconDotsVertical,
  IconHandStop,
  IconLogout,
  IconChevronLeft,
} from '@tabler/icons-react'
import { createClient } from '@/lib/supabase/client'
import type { Cookie, Jar } from '@/lib/types'
import CookieJarLogo from '@/components/CookieJarLogo'
import SignInLanding from '@/components/SignInLanding'
import JarShelf from '@/components/JarShelf'
import CookieCard from '@/components/CookieCard'
import AddCookieSheet from '@/components/AddCookieSheet'
import NewJarSheet from '@/components/NewJarSheet'
import JarMenuSheet from '@/components/JarMenuSheet'
import CookieDetailSheet from '@/components/CookieDetailSheet'
import ReachInModal from '@/components/ReachInModal'

const LAST_KEY = 'cookie-jar:active'

export default function HomePage() {
  const supabase = useMemo(() => createClient(), [])

  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [jars, setJars] = useState<Jar[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [openJarId, setOpenJarId] = useState<string | null>(null) // null = shelf
  const [cookies, setCookies] = useState<Cookie[]>([])
  const [loadingCookies, setLoadingCookies] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // sheets / overlays
  const [showNewJar, setShowNewJar] = useState(false)
  const [showAddCookie, setShowAddCookie] = useState(false)
  const [showJarMenu, setShowJarMenu] = useState(false)
  const [detailCookie, setDetailCookie] = useState<Cookie | null>(null)
  const [reachCookie, setReachCookie] = useState<Cookie | null>(null)
  const [drawKey, setDrawKey] = useState(0)

  const openJar = useMemo(() => jars.find((j) => j.id === openJarId) ?? null, [jars, openJarId])

  const signIn = useCallback(() => {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/` },
    })
  }, [supabase])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSignedIn(false)
    setUserId(null)
    setJars([])
    setCounts({})
    setOpenJarId(null)
    setCookies([])
  }, [supabase])

  // Auth + initial load (jars + per-jar cookie counts)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSignedIn(false); return }
      setSignedIn(true)
      setUserId(user.id)

      const [{ data: jarRows }, { data: cookieRows }] = await Promise.all([
        supabase.schema('cookie_jar').from('jars').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
        supabase.schema('cookie_jar').from('cookies').select('jar_id').eq('user_id', user.id),
      ])
      setJars((jarRows ?? []) as Jar[])
      const tally: Record<string, number> = {}
      for (const row of (cookieRows ?? []) as { jar_id: string }[]) {
        tally[row.jar_id] = (tally[row.jar_id] ?? 0) + 1
      }
      setCounts(tally)
    }
    init()
  }, [supabase])

  // Load cookies when a jar is opened
  useEffect(() => {
    if (!openJarId) { setCookies([]); return }
    localStorage.setItem(LAST_KEY, openJarId)
    let cancelled = false
    setLoadingCookies(true)
    supabase
      .schema('cookie_jar')
      .from('cookies')
      .select('*')
      .eq('jar_id', openJarId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return
        const list = (data ?? []) as Cookie[]
        setCookies(list)
        setCounts((prev) => ({ ...prev, [openJarId]: list.length }))
        setLoadingCookies(false)
      })
    return () => { cancelled = true }
  }, [supabase, openJarId])

  const createJar = useCallback(
    async (name: string) => {
      if (!userId) return
      const { data, error: e } = await supabase
        .schema('cookie_jar').from('jars').insert({ user_id: userId, name }).select().single()
      if (e) { setError(e.message); return }
      if (data) {
        const jar = data as Jar
        setJars((prev) => [...prev, jar])
        setCounts((prev) => ({ ...prev, [jar.id]: 0 }))
        setOpenJarId(jar.id) // open the new jar so you can fill it
      }
    },
    [supabase, userId]
  )

  const renameJar = useCallback(
    async (name: string) => {
      if (!openJar) return
      setJars((prev) => prev.map((j) => (j.id === openJar.id ? { ...j, name } : j)))
      const { error: e } = await supabase.schema('cookie_jar').from('jars').update({ name }).eq('id', openJar.id)
      if (e) setError(e.message)
    },
    [supabase, openJar]
  )

  const deleteJar = useCallback(
    async (jar: Jar) => {
      setShowJarMenu(false)
      setOpenJarId(null)
      setJars((prev) => prev.filter((j) => j.id !== jar.id))
      setCounts((prev) => { const n = { ...prev }; delete n[jar.id]; return n })
      const { error: e } = await supabase.schema('cookie_jar').from('jars').delete().eq('id', jar.id)
      if (e) setError(e.message)
    },
    [supabase]
  )

  const addCookie = useCallback(
    async (input: { title: string; description: string | null; earnedOn: string | null }) => {
      if (!userId || !openJarId) return
      const { data, error: e } = await supabase
        .schema('cookie_jar').from('cookies')
        .insert({ user_id: userId, jar_id: openJarId, title: input.title, description: input.description, earned_on: input.earnedOn })
        .select().single()
      if (e) { setError(e.message); return }
      if (data) {
        setCookies((prev) => [data as Cookie, ...prev])
        setCounts((prev) => ({ ...prev, [openJarId]: (prev[openJarId] ?? 0) + 1 }))
      }
    },
    [supabase, userId, openJarId]
  )

  const deleteCookie = useCallback(
    async (cookie: Cookie) => {
      setDetailCookie(null)
      setCookies((prev) => prev.filter((c) => c.id !== cookie.id))
      setCounts((prev) => ({ ...prev, [cookie.jar_id]: Math.max(0, (prev[cookie.jar_id] ?? 1) - 1) }))
      const { error: e } = await supabase.schema('cookie_jar').from('cookies').delete().eq('id', cookie.id)
      if (e) {
        setCookies((prev) => [cookie, ...prev])
        setCounts((prev) => ({ ...prev, [cookie.jar_id]: (prev[cookie.jar_id] ?? 0) + 1 }))
        setError(e.message)
      }
    },
    [supabase]
  )

  // Draw a random cookie — avoid repeating the one already on screen.
  const reachIn = useCallback(() => {
    if (cookies.length === 0) return
    let pick = cookies[Math.floor(Math.random() * cookies.length)]
    if (cookies.length > 1 && reachCookie) {
      while (pick.id === reachCookie.id) pick = cookies[Math.floor(Math.random() * cookies.length)]
    }
    setReachCookie(pick)
    setDrawKey((k) => k + 1)
  }, [cookies, reachCookie])

  if (signedIn === null) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <IconCookie size={32} stroke={1.5} className="animate-pulse text-coral" />
      </main>
    )
  }
  if (signedIn === false) return <SignInLanding onSignIn={signIn} />

  const pagePad = {
    paddingTop: 'calc(1.25rem + env(safe-area-inset-top))',
    paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))',
  }

  // ---- SHELF (home) ----
  if (!openJar) {
    return (
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-[460px] flex-col px-4" style={pagePad}>
        <header className="mb-2 flex items-center gap-2.5">
          <CookieJarLogo size={32} />
          <h1 className="flex-1 text-xl font-semibold tracking-tight text-text">Cookie Jar</h1>
          <button
            type="button" onClick={signOut} aria-label="Sign out"
            className="flex min-h-11 min-w-11 items-center justify-center text-text-low transition-colors active:text-text-muted"
          >
            <IconLogout size={20} stroke={1.5} />
          </button>
        </header>

        {jars.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <button
              type="button" onClick={() => setShowNewJar(true)} aria-label="Create your first jar"
              className="flex aspect-square w-[60%] max-w-[260px] items-center justify-center rounded-[22%] border-2 border-dashed border-border text-text-low transition-colors active:border-coral active:text-coral"
            >
              <IconPlus size={72} stroke={1.5} />
            </button>
            <p className="mt-6 max-w-[280px] text-text-muted">
              No jars yet. Create one and start banking the hard things you&apos;ve conquered.
            </p>
          </div>
        ) : (
          <JarShelf
            jars={jars}
            counts={counts}
            initialId={typeof window !== 'undefined' ? localStorage.getItem(LAST_KEY) : null}
            onOpen={(j) => setOpenJarId(j.id)}
            onNewJar={() => setShowNewJar(true)}
          />
        )}

        {error && <p role="alert" className="mt-4 px-1 text-xs leading-snug text-coral">Something went wrong: {error}</p>}
        {showNewJar && <NewJarSheet onCreate={createJar} onClose={() => setShowNewJar(false)} />}
      </main>
    )
  }

  // ---- JAR DETAIL ----
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[420px] flex-col px-4" style={pagePad}>
      <header className="mb-4 flex items-center gap-1">
        <button
          type="button" onClick={() => setOpenJarId(null)} aria-label="Back to shelf"
          className="-ml-2 flex min-h-11 min-w-11 items-center justify-center text-text-muted transition-colors active:text-text"
        >
          <IconChevronLeft size={24} stroke={2} />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-2xl font-semibold tracking-tight text-text">{openJar.name}</h1>
        <button
          type="button" onClick={() => setShowJarMenu(true)} aria-label="Jar settings"
          className="flex min-h-11 min-w-11 items-center justify-center text-text-low transition-colors active:text-text-muted"
        >
          <IconDotsVertical size={20} stroke={1.5} />
        </button>
      </header>

      <p className="mb-4 text-sm text-text-low">
        {cookies.length} {cookies.length === 1 ? 'cookie' : 'cookies'}
      </p>

      <button
        type="button" onClick={reachIn} disabled={cookies.length === 0}
        className="reach-glow mb-3 flex min-h-14 items-center justify-center gap-2.5 rounded-2xl bg-coral text-lg font-semibold text-white transition-transform active:scale-[0.98] active:bg-coral-bright disabled:opacity-40 disabled:shadow-none"
      >
        <IconHandStop size={22} stroke={2} />
        Reach in
      </button>

      <button
        type="button" onClick={() => setShowAddCookie(true)}
        className="mb-6 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface font-medium text-text-muted transition active:scale-[0.98] active:bg-surface-elevated"
      >
        <IconPlus size={18} stroke={2} />
        Add a cookie
      </button>

      <p className="mb-2 px-1 text-xs uppercase tracking-wide text-text-low">All cookies</p>
      <section className="flex flex-col gap-2.5">
        {loadingCookies ? (
          <p className="py-10 text-center text-sm text-text-low">Loading…</p>
        ) : cookies.length === 0 ? (
          <p className="py-10 text-center text-sm text-text-low">This jar is empty. Add the first hard thing you conquered.</p>
        ) : (
          cookies.map((c) => (
            <div key={c.id} className="cookie-fade-in">
              <CookieCard cookie={c} onTap={setDetailCookie} />
            </div>
          ))
        )}
      </section>

      {error && <p role="alert" className="mt-4 px-1 text-xs leading-snug text-coral">Something went wrong: {error}</p>}

      {showAddCookie && (
        <AddCookieSheet jarName={openJar.name} onSave={addCookie} onClose={() => setShowAddCookie(false)} />
      )}
      {showJarMenu && (
        <JarMenuSheet jar={openJar} cookieCount={cookies.length} onRename={renameJar} onDelete={deleteJar} onClose={() => setShowJarMenu(false)} />
      )}
      {detailCookie && (
        <CookieDetailSheet cookie={detailCookie} onDelete={deleteCookie} onClose={() => setDetailCookie(null)} />
      )}
      {reachCookie && (
        <ReachInModal cookie={reachCookie} drawKey={drawKey} onAgain={reachIn} canDrawAgain={cookies.length > 1} onClose={() => setReachCookie(null)} />
      )}
    </main>
  )
}
