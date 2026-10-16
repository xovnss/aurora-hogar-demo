import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Los formularios (saldos, productos, carga rápida) mandan las fotos en base64 dentro del
    // server action. El límite por defecto es 1MB: un saldo con foto principal + fotos extra se
    // pasaba y el servidor crasheaba con "A server error occurred". Lo subimos para que quepan.
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
