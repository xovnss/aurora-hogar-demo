"use client";

// Pantalla amable si algo falla en /subir (antes salía la pantalla de error de Vercel).
// Reintenta sin recargar todo, o recarga la página.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="font-display flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#0e2650] via-[#164079] to-[#2e6da4] px-4 py-10 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/bam-logo.png" alt="BAM!" className="mb-5 h-11 w-auto" />
      <div className="w-full max-w-md rounded-[28px] border-4 border-white/20 bg-white p-7 shadow-2xl">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-3xl">😕</div>
        <h1 className="font-display text-xl font-bold text-[#0e2650]">Se atoró un momento</h1>
        <p className="mt-1 text-sm text-gray-500">
          A veces Odoo tarda o pone un límite de peticiones. No se perdió nada. Dale a <b>Reintentar</b>.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button onClick={() => reset()} className="pf-btn w-full px-4 py-3">🔄 Reintentar</button>
          <button onClick={() => location.reload()} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">Recargar la página</button>
        </div>
        {error?.digest && <p className="mt-3 text-[10px] text-gray-300">ref: {error.digest}</p>}
      </div>
    </div>
  );
}
