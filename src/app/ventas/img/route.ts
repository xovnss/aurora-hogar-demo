// VERSIÓN DEMO — misma idea que /img, pero es la que usan las fichas para poder exportarlas
// a PNG sin que el navegador "manche" el lienzo con una imagen de otro dominio.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id || !/^\d+$/.test(id)) return new Response("bad id", { status: 400 });
  const url = new URL(request.url);
  url.pathname = "/img";
  url.search = `?id=${id}&s=1024`;
  const r = await fetch(url.toString());
  const svg = await r.text();
  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
