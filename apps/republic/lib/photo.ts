// Downscales a data URL selfie into a small JPEG thumbnail — small enough to
// survive in sessionStorage across a refresh (the full-resolution original is
// deliberately never persisted, see lib/applicationContext.tsx). Used only to
// restore the visa sticker's photo after a reload once the full-res capture
// is gone from memory; the live, in-session composite always uses the
// original. Best-effort: any failure resolves `null`, and callers fall back
// to a "PHOTO ON FILE" placeholder rather than blocking on this.

export function createThumbnail(dataUrl: string, maxDimension = 200, quality = 0.6): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image()
      img.onload = () => {
        try {
          const scale = Math.min(1, maxDimension / Math.max(img.width, img.height))
          const width = Math.max(1, Math.round(img.width * scale))
          const height = Math.max(1, Math.round(img.height * scale))
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(null)
            return
          }
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', quality))
        } catch {
          resolve(null)
        }
      }
      img.onerror = () => resolve(null)
      img.src = dataUrl
    } catch {
      resolve(null)
    }
  })
}
