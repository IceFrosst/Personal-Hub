import { IconCookie } from '@tabler/icons-react'

export default function CookieJarLogo({ size = 40 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-2xl shrink-0"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(150deg, #ec5d5e 0%, #e5484d 45%, #aa2429 100%)',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.1) inset',
      }}
    >
      <IconCookie size={Math.round(size * 0.58)} stroke={1.5} color="#fff" />
    </span>
  )
}
