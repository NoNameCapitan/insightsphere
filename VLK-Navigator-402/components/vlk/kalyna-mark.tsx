/** A small kalyna sprig, using the emblem's existing gold and green palette. */
export function KalynaMark({ gold }: { gold: string }) {
  return <g data-kalyna-mark aria-hidden="true" strokeLinecap="round" strokeLinejoin="round">
    <path d="M50 28V20M50 24 46 20M50 24 54 20" fill="none" stroke={gold} strokeWidth=".9" />
    <path d="M49 25Q42 26 43 21Q48 21 49 25ZM51 26Q58 26 57 22Q52 22 51 26Z" fill="#075348" />
    <g fill={gold}>
      <circle cx="46" cy="18.5" r="2" /><circle cx="50" cy="16.5" r="2.1" /><circle cx="54" cy="18.5" r="2" />
      <circle cx="50" cy="21" r="2" />
    </g>
  </g>;
}
