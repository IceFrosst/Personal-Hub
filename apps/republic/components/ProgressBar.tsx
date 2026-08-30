export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full border-2 border-navy bg-paper p-1">
      <div
        className="h-4 bg-navy transition-[width] duration-300 ease-out"
        style={{ width: `${percent}%` }}
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  )
}
