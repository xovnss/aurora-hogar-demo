import React from "react";

// Convierte *texto* (o **texto**) en negritas. Conserva saltos de línea y el resto del texto tal cual.
export function renderNegritas(text: string): React.ReactNode {
  if (!text) return null;
  const re = /\*+([^*\n]+?)\*+/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<strong key={i++} className="font-bold text-stone-800">{m[1]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
