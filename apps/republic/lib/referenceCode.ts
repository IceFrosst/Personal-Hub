const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I ambiguity

export function generateReferenceCode(): string {
  let suffix = ''
  for (let i = 0; i < 4; i++) {
    suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return `RIG-${suffix}`
}

// The visa sticker's SERIAL № format (`SN-` + 6 digits). Generated once per
// application at visa selection (well before a reference code exists) and
// stored in applicationContext (see ApplicationState#serial), so the progress
// card and the final /visa-issued sticker always render the identical value
// instead of each computing their own.
export function generateSerial(): string {
  const n = 100000 + Math.floor(Math.random() * 900000)
  return `SN-${n}`
}
