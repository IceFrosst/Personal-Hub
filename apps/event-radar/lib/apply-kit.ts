// Apply Kit — the reusable application profile and drafted answers.
// The profile lives in hackathon.application_profiles.profile (jsonb); this
// file owns its shape. All fields are free-text strings so the form binds
// simply and nothing is ever "invalid" — missing facts just mean the drafter
// leaves a [TODO] for that part.

export type ApplicationProfile = {
  full_name: string
  email: string
  school: string
  degree: string
  graduation_year: string
  city: string
  country: string
  bio: string
  skills: string
  achievements: string
  github: string
  linkedin: string
  portfolio: string
  extra: string
}

export const EMPTY_PROFILE: ApplicationProfile = {
  full_name: '',
  email: '',
  school: '',
  degree: '',
  graduation_year: '',
  city: '',
  country: '',
  bio: '',
  skills: '',
  achievements: '',
  github: '',
  linkedin: '',
  portfolio: '',
  extra: '',
}

// Merge a stored jsonb profile (possibly older/partial) onto the empty shape.
export function coerceProfile(raw: unknown): ApplicationProfile {
  if (typeof raw !== 'object' || raw === null) return { ...EMPTY_PROFILE }
  const r = raw as Record<string, unknown>
  const out = { ...EMPTY_PROFILE }
  for (const key of Object.keys(EMPTY_PROFILE) as Array<keyof ApplicationProfile>) {
    const v = r[key]
    if (typeof v === 'string') out[key] = v
  }
  return out
}

export function profileIsEmpty(p: ApplicationProfile): boolean {
  return Object.values(p).every((v) => v.trim() === '')
}

export type DraftAnswer = {
  question: string
  answer: string
}

export const PROFILE_FIELD_META: Array<{
  key: keyof ApplicationProfile
  label: string
  multiline?: boolean
  placeholder?: string
}> = [
  { key: 'full_name', label: 'Full name' },
  { key: 'email', label: 'Email' },
  { key: 'school', label: 'School / university' },
  { key: 'degree', label: 'Degree / program' },
  { key: 'graduation_year', label: 'Graduation year' },
  { key: 'city', label: 'City' },
  { key: 'country', label: 'Country' },
  { key: 'bio', label: 'Short bio', multiline: true, placeholder: 'Who you are in 2–3 sentences' },
  { key: 'skills', label: 'Skills', multiline: true, placeholder: 'Languages, tools, what you build with' },
  {
    key: 'achievements',
    label: 'Achievements',
    multiline: true,
    placeholder: 'Hackathon wins, projects, anything worth bragging about',
  },
  { key: 'github', label: 'GitHub URL' },
  { key: 'linkedin', label: 'LinkedIn URL' },
  { key: 'portfolio', label: 'Portfolio / website' },
  {
    key: 'extra',
    label: 'Anything else',
    multiline: true,
    placeholder: 'Context the drafter should know (visa needs, team, motivation…)',
  },
]
