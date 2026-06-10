// Cookie Jar — Goggins' cookie jar. Log the hard things you've already
// conquered (cookies), keep them in named jars, reach in for fuel later.

export interface Jar {
  id: string
  user_id: string
  name: string
  color: string // accent name (see JAR_COLORS in lib/jar.ts); defaults to 'coral'
  created_at: string
}

export interface Cookie {
  id: string
  user_id: string
  jar_id: string
  title: string
  description: string | null
  earned_on: string | null // date (YYYY-MM-DD), optional
  last_drawn_at: string | null // last reach-in draw; biases draws toward least-recently-drawn
  created_at: string
}
