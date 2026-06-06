'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  IconCookie,
  IconPlus,
  IconLogout,
  IconChevronLeft,
  IconSettings,
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
  const [activeIndex, setActiveIndex] = useState(0) // centered slide on the shelf
  const [focusId, setFocusId] = useState<string | null>(null) // jar to center after add/delete
  const [viewingList, setViewingList] = useState(false) // the open-jar cookie list
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

  // the centered jar (null when sitting on the "new jar" slide)
  const activeJar: Jar | null = activeIndex < jars.length ? jars[activeIndex] : null

  const signIn = useCallback(() => {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/` },
    })
  }, [supabase])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSignedIn(false); setUserId(null); setJars([]); setCounts({}); setCookies([]); setViewingList(false)
  }, [supabase])

  // Auth + initial load (jars + per-jar cookie counts)
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSignedIn(false); return }
      setSignedIn(true); setUserId(user.id)
      const [{ data: jarRows }, { data: cookieRows }] = await Promise.all([
        supabase.schema('cookie_jar').from('jars').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
        supabase.schema('cookie_jar').from('cookies').select('jar_id').eq('user_id', user.id),
      ])
      const list = (jarRows ?? []) as Jar[]
      setJars(list)
      const tally: Record<string, number> = {}
      for (const row of (cookieRows ?? []) as { jar_id: string }[]) tally[row.jar_id] = (tally[row.jar_id] ?? 0) + 1
      setCounts(tally)
      const last = localStorage.getItem(LAST_KEY)
      const idx = last ? list.findIndex((j) => j.id === last) : 0
      setFocusId(idx > 0 ? last : list[0]?.id ?? null)
      setActiveIndex(idx > 0 ? idx : 0)
    }
    init()
  }, [supabase])

  // Load the centered jar's cookies (for reach-in / add / list)
  useEffect(() => {
    const id = activeJar?.id
    if (!id) { setCookies([]); return }
    localStorage.setItem(LAST_KEY, id)
    let cancelled = false
    setLoadingCookies(true)
    supabase
      .schema('cookie_jar').from('cookies').select('*').eq('jar_id', id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return
        const list = (data ?? []) as Cookie[]
        setCookies(list)
        setCounts((prev) => ({ ...prev, [id]: list.length }))
        setLoadingCookies(false)
      })
    return () => { cancelled = true }
  }, [supabase, activeJar?.id])

  const createJar = useCallback(
    async (name: string, color: string) => {
      if (!userId) return
      const { data, error: e } = await supabase
        .schema('cookie_jar').from('jars').insert({ user_id: userId, name, color }).select().single()
      if (e) { setError(e.message); return }
      if (data) {
        const jar = data as Jar
        setCounts((prev) => ({ ...prev, [jar.id]: 0 }))
        setJars((prev) => [...prev, jar])
        setFocusId(jar.id) // shelf remounts and centers the new jar
      }
    },
    [supabase, userId]
  )

  const renameJar = useCallback(
    async (name: string) => {
      if (!activeJar) return
      setJars((prev) => prev.map((j) => (j.id === activeJar.id ? { ...j, name } : j)))
      const { error: e } = await supabase.schema('cookie_jar').from('jars').update({ name }).eq('id', activeJar.id)
      if (e) setError(e.message)
    },
    [supabase, activeJar]
  )

  const recolorJar = useCallback(
    async (color: string) => {
      if (!activeJar) return
      setJars((prev) => prev.map((j) => (j.id === activeJar.id ? { ...j, color } : j)))
      const { error: e } = await supabase.schema('cookie_jar').from('jars').update({ color }).eq('id', activeJar.id)
      if (e) setError(e.message)
    },
    [supabase, activeJar]
  )

  const deleteJar = useCallback(
    async (jar: Jar) => {
      setShowJarMenu(false); setViewingList(false)
      setActiveIndex(0); setFocusId(jars[0]?.id ?? null)
      setJars((prev) => prev.filter((j) => j.id !== jar.id))
      setCounts((prev) => { const n = { ...prev }; delete n[jar.id]; return n })
      const { error: e } = await supabase.schema('cookie_jar').from('jars').delete().eq('id', jar.id)
      if (e) setError(e.message)
    },
    [supabase, jars]
  )

  const addCookie = useCallback(
    async (input: { title: string; description: string | null; earnedOn: string | null }) => {
      if (!userId || !activeJar) return
      const jarId = activeJar.id
      const { data, error: e } = await supabase
        .schema('cookie_jar').from('cookies')
        .insert({ user_id: userId, jar_id: jarId, title: input.title, description: input.description, earned_on: input.earnedOn })
        .select().single()
      if (e) { setError(e.message); return }
      if (data) {
        setCookies((prev) => [data as Cookie, ...prev])
        setCounts((prev) => ({ ...prev, [jarId]: (prev[jarId] ?? 0) + 1 }))
      }
    },
    [supabase, userId, activeJar]
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
    setReachCookie(pick); setDrawKey((k) => k + 1)
  }, [cookies, reachCookie])

  // tap the centred jar: reach in (or, if it's empty, jump to adding a cookie)
  const tapJar = useCallback((jar: Jar) => {
    if ((counts[jar.id] ?? 0) === 0) setShowAddCookie(true)
    else reachIn()
  }, [counts, reachIn])

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
  const count = activeJar ? counts[activeJar.id] ?? 0 : 0

  // ---- OPEN JAR: the cookie list ----
  if (viewingList && activeJar) {
    return (
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-[420px] flex-col px-4" style={pagePad}>
        <header className="mb-4 flex items-center gap-1">
          <button type="button" onClick={() => setViewingList(false)} aria-label="Back to shelf"
            className="-ml-2 flex min-h-11 min-w-11 items-center justify-center text-text-muted transition-colors active:text-text">
            <IconChevronLeft size={24} stroke={2} />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-2xl font-semibold tracking-tight text-text">{activeJar.name}</h1>
          <button type="button" onClick={() => setShowJarMenu(true)} aria-label="Jar settings"
            className="flex min-h-11 min-w-11 items-center justify-center text-text-low transition-colors active:text-text-muted">
            <IconSettings size={20} stroke={1.5} />
          </button>
        </header>

        <p className="mb-4 text-sm text-text-low">{count} {count === 1 ? 'cookie' : 'cookies'}</p>

        <section className="flex flex-col gap-2.5">
          {loadingCookies ? (
            <p className="py-10 text-center text-sm text-text-low">Loading…</p>
          ) : cookies.length === 0 ? (
            <p className="py-10 text-center text-sm text-text-low">This jar is empty. Add the first hard thing you conquered.</p>
          ) : (
            cookies.map((c) => (
              <div key={c.id} className="cookie-fade-in"><CookieCard cookie={c} onTap={setDetailCookie} /></div>
            ))
          )}
        </section>

        {error && <p role="alert" className="mt-4 px-1 text-xs leading-snug text-coral">Something went wrong: {error}</p>}
        {showJarMenu && (
          <JarMenuSheet jar={activeJar} cookieCount={count} onRename={renameJar} onColor={recolorJar} onDelete={deleteJar} onClose={() => setShowJarMenu(false)} />
        )}
        {detailCookie && <CookieDetailSheet cookie={detailCookie} onDelete={deleteCookie} onClose={() => setDetailCookie(null)} />}
      </main>
    )
  }

  // ---- SHELF (home) ----
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[460px] flex-col px-4" style={pagePad}>
      <header className="mb-2 flex items-center gap-2.5">
        <CookieJarLogo size={32} />
        <h1 className="flex-1 text-xl font-semibold tracking-tight text-text">Cookie Jar</h1>
        <button type="button" onClick={signOut} aria-label="Sign out"
          className="flex min-h-11 min-w-11 items-center justify-center text-text-low transition-colors active:text-text-muted">
          <IconLogout size={20} stroke={1.5} />
        </button>
      </header>

      {jars.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <button type="button" onClick={() => setShowNewJar(true)} aria-label="Create your first jar"
            className="flex aspect-square w-[60%] max-w-[260px] items-center justify-center rounded-[26%] border-2 border-dashed border-border text-text-low transition-colors active:border-coral active:text-coral">
            <IconPlus size={72} stroke={1.5} />
          </button>
          <p className="mt-6 max-w-[280px] text-text-muted">No jars yet. Create one and start banking the hard things you&apos;ve conquered.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="w-full" style={{ height: 'clamp(290px, 46vh, 380px)' }}>
              <JarShelf
                key={jars.length}
                jars={jars}
                counts={counts}
                initialId={focusId}
                onActive={setActiveIndex}
                onTap={tapJar}
                onLongPress={() => setShowJarMenu(true)}
                onNewJar={() => setShowNewJar(true)}
              />
            </div>

            {/* the only thing below the jar: its name */}
            <h2 className="mt-1 max-w-full truncate px-6 text-2xl font-semibold tracking-tight text-text">
              {activeJar ? activeJar.name : 'New jar'}
            </h2>

            {/* dots */}
            <div className="mt-3 flex items-center justify-center gap-1.5">
              {jars.map((j, i) => (
                <span key={j.id} className={`h-1.5 rounded-full transition-all ${i === activeIndex ? 'w-4 bg-coral' : 'w-1.5 bg-border'}`} />
              ))}
              <span className={`h-1.5 rounded-full transition-all ${activeIndex === jars.length ? 'w-4 bg-coral' : 'w-1.5 bg-border'}`} />
            </div>

            <p className="mt-3 text-xs text-text-low">{activeJar ? 'Tap to reach in · long-press for settings' : 'Tap to create a new jar'}</p>
          </div>

          {/* the only button on the main screen: add a cookie */}
          {activeJar && (
            <div className="flex justify-center pt-3">
              <button type="button" onClick={() => setShowAddCookie(true)} aria-label="Add a cookie"
                className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-surface text-text transition active:scale-[0.94] active:bg-surface-elevated">
                <IconPlus size={28} stroke={2} />
              </button>
            </div>
          )}
        </>
      )}

      {error && <p role="alert" className="mt-4 px-1 text-xs leading-snug text-coral">Something went wrong: {error}</p>}

      {showNewJar && <NewJarSheet onCreate={createJar} onClose={() => setShowNewJar(false)} />}
      {showAddCookie && activeJar && (
        <AddCookieSheet jarName={activeJar.name} onSave={addCookie} onClose={() => setShowAddCookie(false)} />
      )}
      {showJarMenu && activeJar && (
        <JarMenuSheet
          jar={activeJar}
          cookieCount={count}
          onShowAll={() => { setShowJarMenu(false); setViewingList(true) }}
          onRename={renameJar}
          onColor={recolorJar}
          onDelete={deleteJar}
          onClose={() => setShowJarMenu(false)}
        />
      )}
      {reachCookie && (
        <ReachInModal cookie={reachCookie} drawKey={drawKey} onAgain={reachIn} canDrawAgain={cookies.length > 1} onClose={() => setReachCookie(null)} />
      )}
    </main>
  )
}
