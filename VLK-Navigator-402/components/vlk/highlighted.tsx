import { displayHighlightParts } from "@/lib/vlk-highlight";

/** React text nodes only: a diagnosis query must never become HTML. */
export function Highlighted({ text, query = "" }: { text: string; query?: string }) {
  if (!query.trim()) return <>{text}</>;
  return <>{displayHighlightParts(text, query).map((part, index) => part.match
    ? <mark key={index} className="search-highlight">{part.text}</mark>
    : <span key={index}>{part.text}</span>)}</>;
}
