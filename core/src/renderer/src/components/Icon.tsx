const paths = {
  search: 'm16 16 5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  copy: 'M8 8h12v13H8z M16 8V3H3v13h5',
  paste: 'M8 5H4v16h16V5h-4 M8 3h8v4H8z',
  stop: 'M6 6h12v12H6z',
  terminal: 'm5 7 5 5-5 5 M13 17h6',
  external: 'M14 5h5v5 M19 5l-9 9 M19 14v5H5V5h5',
  plus: 'M12 5v14 M5 12h14',
  close: 'm7 7 10 10 M17 7 7 17',
  split: 'M4 5h16v14H4z M12 5v14',
  'split-down': 'M4 5h16v14H4z M4 12h16',
  commands: 'm5 6 5 6-5 6 M13 18h6',
  appearance: 'M12 3a9 9 0 1 0 9 9h-9z M12 3v9',
  history: 'M4 5v5h5 M4.5 10a8 8 0 1 1 .5 6 M12 8v5l3 2',
  settings: 'M4 7h16 M4 17h16 M8 4v6 M16 14v6',
  folder: 'M3 7h6l2 2h10v10H3z M3 7V5h6l2 2h8v2',
  lock: 'M6 11h12v10H6z M8 11V7a4 4 0 0 1 8 0v4',
  chevron: 'm7 10 5 5 5-5',
  download: 'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5'
}

export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  )
}
