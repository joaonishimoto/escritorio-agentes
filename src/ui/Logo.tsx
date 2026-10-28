/**
 * Marca do Escritório de Agentes: um agente (robozinho com antena) nas cores do
 * Nishistack (Azul Nishi + Creme Stack). Mesma arte de public/favicon.svg.
 */
export function Logo({ className = 'logo' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 512 512" aria-hidden="true">
      <rect width="512" height="512" rx="112" fill="#1E3D66" />
      <g transform="translate(96 104) scale(3.2)">
        <rect x="39" y="0" width="22" height="22" rx="6" fill="#FAF5EB" />
        <rect x="5" y="28" width="90" height="72" rx="18" fill="#FAF5EB" />
        <g fill="#1E3D66">
          <rect x="25" y="52" width="17" height="20" rx="5" />
          <rect x="58" y="52" width="17" height="20" rx="5" />
        </g>
      </g>
    </svg>
  )
}
