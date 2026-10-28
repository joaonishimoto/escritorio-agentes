import { DataTexture, NearestFilter, RedFormat } from 'three'

/** Rampa de 3 tons para o meshToonMaterial: luz, meia-luz e sombra bem marcadas, com cara de jogo. */
export const GRADIENTE = (() => {
  const t = new DataTexture(new Uint8Array([90, 170, 255]), 3, 1, RedFormat)
  t.minFilter = NearestFilter
  t.magFilter = NearestFilter
  t.generateMipmaps = false
  t.needsUpdate = true
  return t
})()

export const CONTORNO = '#1f2330'
