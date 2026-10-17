"use client";

// Red de seguridad para cualquier ruta sin su propio error.tsx (fichas, caja, corte, reportes,
// catálogo). Evita la pantalla cruda de error de Vercel; ofrece reintentar/recargar.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center", background: "#fff3f2", color: "#1c1717", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ fontSize: 40 }}>😕</div>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Se atoró un momento</h1>
      <p style={{ margin: 0, maxWidth: 380, color: "#9a504f", fontSize: 14 }}>A veces la conexión con el servidor tarda. No se perdió nada.</p>
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button onClick={() => reset()} style={{ border: 0, cursor: "pointer", borderRadius: 999, background: "#1c1717", color: "#fff", fontWeight: 700, fontSize: 14, padding: "10px 22px" }}>🔄 Reintentar</button>
        <button onClick={() => location.reload()} style={{ cursor: "pointer", borderRadius: 999, background: "#fff", border: "1px solid #e2cbcb", color: "#9a504f", fontWeight: 700, fontSize: 14, padding: "10px 18px" }}>Recargar</button>
      </div>
      {error?.digest && <p style={{ fontSize: 10, color: "#d1b6b6", margin: 0 }}>ref: {error.digest}</p>}
    </div>
  );
}
