/** Tela de abertura do escritório: a mesma do index.html (antes do app carregar), para a troca não piscar. */
export function Abertura({ noPalco = false, frase }: { noPalco?: boolean; frase?: string }) {
  const frases = frase ? [frase] : ['Acendendo as luzes…', 'Ligando os monitores…', 'Chamando a equipe…', 'Passando o café…']
  return (
    <div className={`abertura${noPalco ? ' no-palco' : ''}`} role="status" aria-label="Abrindo o escritório">
      <div className="ab-miolo">
        <div className="ab-cena">
          <svg className="ab-robo" viewBox="0 0 512 512" aria-hidden>
            <rect width="512" height="512" rx="112" fill="#1E3D66" />
            <g transform="translate(96 104) scale(3.2)">
              <rect x="39" y="0" width="22" height="22" rx="6" fill="#FAF5EB" />
              <rect x="5" y="28" width="90" height="72" rx="18" fill="#FAF5EB" />
              <g fill="#1E3D66">
                <rect className="olho" x="25" y="52" width="17" height="20" rx="5" />
                <rect className="olho" x="58" y="52" width="17" height="20" rx="5" />
              </g>
            </g>
          </svg>
          <div className="ab-sombra" />
        </div>
        {!noPalco && <p className="ab-titulo">Escritório de Agentes</p>}
        <div className="ab-barra" aria-hidden>
          {Array.from({ length: 8 }, (_, i) => <i key={i} />)}
        </div>
        <p className={`ab-frase${frases.length === 1 ? ' fixa' : ''}`}>
          {frases.map((f) => <span key={f}>{f}</span>)}
        </p>
      </div>
    </div>
  )
}
