let audio: AudioContext | null = null

/** Plim de duas notas quando um post chega na sua mesa. */
export function tocarAviso() {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
    const agora = audio.currentTime
    for (const [i, freq] of [880, 1318.5].entries()) {
      const osc = audio.createOscillator()
      const vol = audio.createGain()
      const inicio = agora + i * 0.14
      osc.type = 'triangle'
      osc.frequency.value = freq
      vol.gain.setValueAtTime(0.0001, inicio)
      vol.gain.exponentialRampToValueAtTime(0.25, inicio + 0.02)
      vol.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.5)
      osc.connect(vol).connect(audio.destination)
      osc.start(inicio)
      osc.stop(inicio + 0.55)
    }
  } catch {
    // sem áudio no navegador: o boneco pulando já avisa
  }
}

// o navegador só libera som depois de um clique: deixa o áudio pronto no primeiro toque na página
if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    () => {
      try {
        audio ??= new AudioContext()
        void audio.resume()
      } catch {
        // ignora
      }
    },
    { once: true },
  )
}
