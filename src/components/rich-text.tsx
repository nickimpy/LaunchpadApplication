import type { ReactNode } from "react";

// A deliberately tiny, SAFE markup for admin-editable copy: blank-line
// separated paragraphs, **bold**, and [label](url). Nothing else is
// interpreted, and only http(s)/mailto URLs become links — so copy stored in
// cycle_settings can never inject HTML or a javascript: link.

const SAFE_URL = /^(https?:\/\/|mailto:)/i;

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  // Matches **bold** or [label](url), whichever comes first.
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let key = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      out.push(<strong key={key++}>{m[1]}</strong>);
    } else if (SAFE_URL.test(m[3])) {
      const external = /^https?:/i.test(m[3]);
      out.push(
        <a
          key={key++}
          href={m[3]}
          className="font-bold text-teal-dark underline"
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {m[2]}
        </a>,
      );
    } else {
      out.push(m[2]); // unsafe scheme: show the label, drop the link
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Inline-only rendering (no paragraph wrapper), for list items and short lines. */
export function RichInline({ text }: { text: string }) {
  return <>{renderInline(text)}</>;
}

/** Block rendering: each blank-line-separated chunk becomes a paragraph. */
export function RichText({ text }: { text: string }) {
  const blocks = text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  return (
    <>
      {blocks.map((block, i) => (
        <p key={i} className="mb-3 last:mb-0">
          {renderInline(block)}
        </p>
      ))}
    </>
  );
}
