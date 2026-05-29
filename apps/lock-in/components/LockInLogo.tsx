type Props = {
  size?: number
}

export default function LockInLogo({ size = 46 }: Props) {
  return (
    <span
      aria-hidden
      className="lock-in-logo relative inline-block shrink-0"
      style={{ width: size, height: size }}
    >
      <span className="lock-in-logo-bolt" />
    </span>
  )
}
