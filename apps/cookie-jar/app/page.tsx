'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  IconCookie,
  IconPlus,
  IconDotsVertical,
  IconHandStop,
  IconLogout,
} from '@tabler/icons-react'
import { createClient } from '@/lib/supabase/client'
import type { Cookie, Jar } from '@/lib/types'
import CookieJarLogo from '@/components/CookieJarLogo'
import SignInLanding from '@/components/SignInLanding'
import JarSwitcher from '@/components/JarSwitcher'
import CookieCard from '@/components/CookieCard'
import AddCookieSheet from '@/components/AddCookieSheet'
import NewJarSheet from '@/components/NewJarSheet'
import JarMenuSheet from '@/components/JarMenuSheet'
import CookieDetailSheet from '@/components/CookieDetailSheet'
import ReachInModal from '@/components/ReachInModal'

const ACTIVE_KEY = 'cookie-jar:active'

export default function HomePage() {
  const supabase = useMemo(() => createClient(), [])

  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [jars, setJars] = useState<Jar[]>([])
  const [activeJarId, setActiveJarId] = useState<string | null>(null)
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

  const activeJar = useMemo(
    () => jars.find((j) => j.id === activeJarId) ?? null,
    [jars, activeJarId]
  )

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
    setActiveJarId(null)
    setCookies([])
  }, [supabase])

  // Auth + initial jar load
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setSignedIn(false)
        return
      }
      setSignedIn(true)
      setUserId(user.id)

      const { data } = await supabase
        .schema('cookie_jar')
        .from('jars')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      const loaded = (data ?? []) as Jar[]
      setJars(loaded)

      const stored = localStorage.getItem(ACTIVE_KEY)
      const pick = loaded.find((j) => j.id === stored) ?? loaded[0] ?? null
      setActiveJarId(pick?.id ?? null)
    }

    init()
  }, [supabase])

  // Load cookies whenever the active jar changes
  useEffect(() => {
    if (!activeJarId) {
      setCookies([])
      return
    }
    localStorage.setItem(ACTIVE_KEY, activeJarId)
    let cancelled = false
    setLoadingCookies(true)
    supabase
      .schema('cookie_jar')
      .from('cookies')
      .select('*')
      .eq('jar_id', activeJarId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return
        setCookies((data ?? []) as Cookie[])
        setLoadingCookies(false)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, activeJarId])

  const createJar = useCallback(
    async (name: string) => {
      if (!userId) return
      const { data, error: e } = await supabase
        .schema('cookie_jar')
        .from('jars')
        .insert({ user_id: userId, name })
        .select()
        .single()
      if (e) {
        setError(e.message)
        return
      }
      if (data) {
        const jar = data as Jar
        setJars((prev) => [...prev, jar])
        setActiveJarId(jar.id)
      }
    },
    [supabase, userId]
  )

  const renameJar = useCallback(
    async (name: string) => {
      if (!activeJar) return
      setJars((prev) => prev.map((j) => (j.id === activeJar.id ? { ...j, name } : j)))
      const { error: e } = await supabase
        .schema('cookie_jar')
        .from('jars')
        .update({ name })
        .eq('id', activeJar.id)
      if (e) setError(e.message)
    },
    [supabase, activeJar]
  )

  const deleteJar = useCallback(
    async (jar: Jar) => {
      setShowJarMenu(false)
      const remaining = jars.filter((j) => j.id !== jar.id)
      setJars(remaining)
      setActiveJarId(remaining[0]?.id ?? null)
      const { error: e } = await supabase
        .schema('cookie_jar')
        .from('jars')
        .delete()
        .eq('id', jar.id)
      if (e) setError(e.message)
    },
    [supabase, jars]
  )

  const addCookie = useCallback(
    async (input: { title: string; description: string | null; earnedOn: string | null }) => {
      if (!userId || !activeJarId) return
      const { data, error: e } = await supabase
        .schema('cookie_jar')
        .from('cookies')
        .insert({
          user_id: userId,
          jar_id: activeJarId,
          title: input.title,
          description: input.description,
          earned_on: input.earnedOn,
        })
        .select()
        .single()
      if (e) {
        setError(e.message)
        return
      }
      if (data) setCookies((prev) => [data as Cookie, ...prev])
    },
    [supabase, userId, activeJarId]
  )

  const deleteCookie = useCallback(
    async (cookie: Cookie) => {
      setDetailCookie(null)
      setCookies((prev) => prev.filter((c) => c.id !== cookie.id))
      const { error: e } = await supabase
        .schema('cookie_jar')
        .from('cookies')
        .delete()
        .eq('id', cookie.id)
      if (e) {
        setCookies((prev) => [cookie, ...prev])
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
      while (pick.id === reachCookie.id) {
        pick = cookies[Math.floor(Math.random() * cookies.length)]
      }
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

  if (signedIn === false) {
    return <SignInLanding onSignIn={signIn} />
  }

  return (
    <main
      className="mx-auto flex min-h-[100dvh] w-full max-w-[420px] flex-col px-4"
      style={{
        paddingTop: 'calc(1.25rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))',
      }}
    >
      <header className="mb-4 flex items-center gap-2.5">
        <CookieJarLogo size={40} />
        <h1 className="flex-1 text-2xl font-semibold tracking-tight text-text">Cookie Jar</h1>
        <button
          type="button"
          onClick={signOut}
          aria-label="Sign out"
          className="flex min-h-11 min-w-11 items-center justify-center text-text-low transition-colors active:text-text-muted"
        >
          <IconLogout size={20} stroke={1.5} />
        </button>
      </header>

      {jars.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <CookieJarLogo size={64} />
          <p className="mt-5 max-w-[280px] text-text-muted">
            No jars yet. Create one and start banking the hard things you&apos;ve conquered.
          </p>
          <button
            type="button"
            onClick={() => setShowNewJar(true)}
            className="mt-6 flex min-h-12 items-center gap-2 rounded-xl bg-coral px-6 font-semibold text-white transition-transform active:scale-[0.97] active:bg-coral-bright"
          >
            <IconPlus size={18} stroke={2} />
            Create your first jar
          </button>
        </div>
      ) : (
        <>
          <JarSwitcher
            jars={jars}
            activeJarId={activeJarId}
            onSelect={setActiveJarId}
            onNewJar={() => setShowNewJar(true)}
          />

          {activeJar && (
            <>
              <div className="mb-4 mt-5 flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-medium text-text">{activeJar.name}</h2>
                  <p className="text-sm text-text-low">
                    {cookies.length} {cookies.length === 1 ? 'cookie' : 'cookies'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowJarMenu(true)}
                  aria-label="Jar settings"
                  className="flex min-h-11 min-w-11 items-center justify-center text-text-low transition-colors active:text-text-muted"
                >
                  <IconDotsVertical size={20} stroke={1.5} />
                </button>
              </div>

              {/* DRAW A RANDOM ONE */}
              <button
                type="button"
                onClick={reachIn}
                disabled={cookies.length === 0}
                className="reach-glow mb-3 flex min-h-14 items-center justify-center gap-2.5 rounded-2xl bg-coral text-lg font-semibold text-white transition-transform active:scale-[0.98] active:bg-coral-bright disabled:opacity-40 disabled:shadow-none"
              >
                <IconHandStop size={22} stroke={2} />
                Reach in
              </button>

              {/* ADD */}
              <button
                type="button"
                onClick={() => setShowAddCookie(true)}
                className="mb-6 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface font-medium text-text-muted transition active:scale-[0.98] active:bg-surface-elevated"
              >
                <IconPlus size={18} stroke={2} />
                Add a cookie
              </button>

              {/* SHOW ALL */}
              <p className="mb-2 px-1 text-xs uppercase tracking-wide text-text-low">
                All cookies
              </p>
              <section className="flex flex-col gap-2.5">
                {loadingCookies ? (
                  <p className="py-10 text-center text-sm text-text-low">Loading…</p>
                ) : cookies.length === 0 ? (
                  <p className="py-10 text-center text-sm text-text-low">
                    This jar is empty. Add the first hard thing you conquered.
                  </p>
                ) : (
                  cookies.map((c) => (
                    <div key={c.id} className="cookie-fade-in">
                      <CookieCard cookie={c} onTap={setDetailCookie} />
                    </div>
                  ))
                )}
              </section>
            </>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="mt-4 px-1 text-xs leading-snug text-coral">
          Something went wrong: {error}
        </p>
      )}

      {showNewJar && (
        <NewJarSheet onCreate={createJar} onClose={() => setShowNewJar(false)} />
      )}
      {showAddCookie && activeJar && (
        <AddCookieSheet
          jarName={activeJar.name}
          onSave={addCookie}
          onClose={() => setShowAddCookie(false)}
        />
      )}
      {showJarMenu && activeJar && (
        <JarMenuSheet
          jar={activeJar}
          cookieCount={cookies.length}
          onRename={renameJar}
          onDelete={deleteJar}
          onClose={() => setShowJarMenu(false)}
        />
      )}
      {detailCookie && (
        <CookieDetailSheet
          cookie={detailCookie}
          onDelete={deleteCookie}
          onClose={() => setDetailCookie(null)}
        />
      )}
      {reachCookie && (
        <ReachInModal
          cookie={reachCookie}
          drawKey={drawKey}
          onAgain={reachIn}
          canDrawAgain={cookies.length > 1}
          onClose={() => setReachCookie(null)}
        />
      )}
    </main>
  )
}
