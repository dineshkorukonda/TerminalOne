export function Icon({ name }: { name: 'terminal' | 'external' }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {name === 'terminal' ? (
        <>
          <path d="m5 7 5 5-5 5" />
          <path d="M13 17h6" />
        </>
      ) : (
        <>
          <path d="M14 5h5v5M19 5l-9 9" />
          <path d="M19 14v5H5V5h5" />
        </>
      )}
    </svg>
  )
}
