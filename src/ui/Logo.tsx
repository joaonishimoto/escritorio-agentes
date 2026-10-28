/** Marca do Nishistack (Azul Nishi + Creme Stack), a mesma do app principal. */
export function Logo({ className = 'logo' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 512 512" aria-hidden="true">
      <rect width="512" height="512" rx="112" fill="#1E3D66" />
      <g transform="translate(136 136) scale(2.4)" fill="#FAF5EB">
        <rect x="0" y="0" width="22" height="100" rx="3.5" />
        <rect x="78" y="0" width="22" height="100" rx="3.5" />
        <rect x="27" y="14" width="18" height="18" rx="3.5" />
        <rect x="41" y="41" width="18" height="18" rx="3.5" />
        <rect x="55" y="68" width="18" height="18" rx="3.5" />
      </g>
    </svg>
  )
}
