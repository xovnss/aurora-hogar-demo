"use client";

// Red de seguridad para cualquier ruta sin su propio error.tsx (fichas, caja, corte, reportes,
// catálogo). Evita la pantalla cruda de error de Vercel; ofrece reintentar/recargar.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center", background: "#f4f7fb", color: "#0e2650", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ fontSize: 40 }}>😕</div>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Se atoró un momento</h1>
      <p style={{ margin: 0, maxWidth: 380, color: "#5a7492", fontSize: 14 }}>A veces la conexión con el servidor tarda. No se perdió nada.</p>
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button onClick={() => reset()} style={{ border: 0, cursor: "pointer", borderRadius: 999, background: "#0e2650", color: "#fff", fontWeight: 700, fontSize: 14, padding: "10px 22px" }}>🔄 Reintentar</button>
        <button onClick={() => location.reload()} style={{ cursor: "pointer", borderRadius: 999, background: "#fff", border: "1px solid #cbd6e2", color: "#5a7492", fontWeight: 700, fontSize: 14, padding: "10px 18px" }}>Recargar</button>
      </div>
      {error?.digest && <p style={{ fontSize: 10, color: "#b6c2d1", margin: 0 }}>ref: {error.digest}</p>}
    </div>
  );
}
