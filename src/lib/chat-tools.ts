// Herramientas del chatbot de BAM!: funciones normales (sin red) que consultan el catálogo de
// ejemplo, la guía de tallas y las políticas de envío. Las usan los dos "cerebros" del chat:
// el modelo de IA (por function calling) y el modo por reglas (cuando no hay llave de IA).
import { demoProductos, disenos, FAMILIAS } from "./demo-datos";
import { ENVIOS, GUIA, SUCURSALES, TALLAS, recomendarTalla, type Ajuste, type Prenda, type Talla } from "./tallas";

export type ToolSpec = { name: string; description: string; parameters: Record<string, unknown> };

export const norm = (s: string) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ ]/g, " ").replace(/\s+/g, " ").trim();

// ---------- búsqueda de diseños ----------
export function buscarDiseno(texto: string) {
  const q = norm(texto);
  if (!q) return null;
  let mejor: { f: (typeof FAMILIAS)[number]; puntos: number } | null = null;
  for (const f of FAMILIAS) {
    const n = norm(f.nombre);
    let puntos = 0;
    if (q.includes(n)) puntos = 100 + n.length;
    else {
      const ws = n.split(" ").filter((w) => w.length > 2);
      const hit = ws.filter((w) => q.split(" ").includes(w)).length;
      if (hit) puntos = hit * 10 + (hit === ws.length ? 30 : 0);
    }
    if (puntos && (!mejor || puntos > mejor.puntos)) mejor = { f, puntos };
  }
  // sólo vale si empató al menos con una palabra "fuerte" del nombre
  return mejor && mejor.puntos >= 10 ? mejor.f : null;
}

// ---------- 1) recomendar talla ----------
export function toolRecomendarTalla(a: { pecho_cm?: number; cintura_cm?: number; altura_cm?: number; peso_kg?: number; ajuste?: string; prenda?: string }) {
  const prenda: Prenda = a.prenda === "pantalon" ? "pantalon" : a.prenda === "sudadera" ? "sudadera" : "playera";
  const ajuste: Ajuste = a.ajuste === "ajustado" ? "ajustado" : "oversize";
  const r = recomendarTalla({ pecho: a.pecho_cm, cintura: a.cintura_cm, altura: a.altura_cm, peso: a.peso_kg, ajuste, prenda });
  if (r.faltan.length) {
    return { necesito: prenda === "pantalon" ? "Para el pantalón necesito tu cintura en cm (o tu altura y peso)." : "Para recomendar talla necesito al menos una de estas: contorno de pecho en cm, o altura en cm (y de preferencia peso en kg).", guia: guiaTallas() };
  }
  const g = GUIA[r.talla];
  return {
    talla_recomendada: r.talla,
    porque: r.porque,
    prenda,
    corte: prenda === "pantalon" ? "Los pantalones BAM! son wide leg (pierna muy ancha) y de tiro medio: la talla se elige por cintura; el bajo se dobla o se arrastra, como en las fotos." : "Las prendas BAM! son oversize: tu talla de siempre queda holgada como en las fotos.",
    si_la_quieres_mas_pegada: ajuste === "ajustado" ? r.alternativa : TALLAS[Math.max(0, TALLAS.indexOf(r.talla) - 1)],
    si_la_quieres_mas_holgada: ajuste === "oversize" ? r.alternativa : TALLAS[Math.min(TALLAS.length - 1, TALLAS.indexOf(r.talla) + 1)],
    medidas_de_la_prenda_cm: { ancho_pecho: g.ancho, largo: g.largo },
    cambios: ENVIOS.cambios,
  };
}
export function guiaTallas() {
  return TALLAS.map((t) => ({ talla: t, pecho_cm: GUIA[t].pecho.join("–"), cintura_cm: GUIA[t].cintura.join("–"), altura_cm: GUIA[t].altura.join("–"), prenda_ancho_cm: GUIA[t].ancho, prenda_largo_cm: GUIA[t].largo }));
}

// ---------- 2) existencias por talla y sucursal ----------
export function toolExistencias(a: { diseno: string; talla?: string; sucursal?: string }) {
  const f = buscarDiseno(a.diseno);
  if (!f) return { error: `No encontré un diseño que se parezca a «${a.diseno}».`, disenos_disponibles: FAMILIAS.map((x) => x.nombre) };
  const talla = a.talla ? (a.talla.toUpperCase() as Talla) : null;
  const sNorm = a.sucursal ? norm(a.sucursal) : "";
  const suc = sNorm
    ? SUCURSALES.find((s) => [s.id, norm(s.nombre), norm(s.ciudad)].some((x) => x && (sNorm.includes(x) || x.includes(sNorm)))) ||
      (/(roma|df|mexico|cdmx)/.test(sNorm) ? SUCURSALES[0] : /(gdl|guadalajara|jalisco)/.test(sNorm) ? SUCURSALES[1] : /(mty|monterrey|nuevo leon|san pedro)/.test(sNorm) ? SUCURSALES[2] : null)
    : null;
  const prods = demoProductos().filter((p) => p.sku === f.linea || p.sku.startsWith(f.linea + "-"));
  const filas = prods
    .map((p) => { const ult = p.sku.split("-").pop() || ""; return { talla: ((TALLAS as string[]).includes(ult) ? ult : "Única") as Talla, p }; })
    .filter((x) => !talla || x.talla === "Única" as Talla || x.talla === talla)
    .sort((x, y) => TALLAS.indexOf(x.talla) - TALLAS.indexOf(y.talla))
    .map(({ talla: t, p }) => {
      const s = p.stockSucursal || {};
      const out: Record<string, number | string> = { talla: t };
      for (const x of SUCURSALES) if (!suc || suc.id === x.id) out[x.nombre] = s[x.id] ?? 0;
      out["envío a domicilio (bodega)"] = s.bodega ?? 0;
      return out;
    });
  const precio = f.liquidacion ?? f.publico;
  return {
    diseno: f.nombre, tipo: f.prenda || "playera", color: f.color, precio_publico: f.publico, precio_socios: f.socio, precio_liquidacion: f.liquidacion ?? null, precio_vigente: precio,
    existencias_por_talla: filas,
    nota: "Piezas disponibles ahora. 0 = agotado en esa sucursal. «envío a domicilio» es la bodega, de donde salen los paquetes.",
  };
}

// ---------- 3) catálogo ----------
export function toolListarDisenos() {
  return disenos().map((d) => ({ diseno: d.nombre, color: d.color, tipo: d.prenda, donde_va_el_estampado: d.categoria.toLowerCase().includes("espalda") ? "espalda" : "frente", precio: d.liquidacion ?? d.precio, precio_socios: d.precioSocio, en_liquidacion: d.liquidacion != null }));
}

// ---------- 4) envíos, recoger y cambios ----------
export function toolEnvios(a: { ciudad?: string; total_pedido?: number }) {
  const total = a.total_pedido && a.total_pedido > 0 ? a.total_pedido : null;
  const gratis = total != null ? total >= ENVIOS.gratisDesde : null;
  const c = norm(a.ciudad || "");
  const hayExpres = /(mexico|cdmx|df|guadalajara|gdl|monterrey|mty)/.test(c);
  return {
    envio_estandar: { costo: gratis ? 0 : ENVIOS.costo, tiempo: ENVIOS.dias, gratis_desde: ENVIOS.gratisDesde, gratis_en_este_pedido: gratis },
    envio_expres: hayExpres || !c ? { ...ENVIOS.expres, disponible_en_tu_ciudad: c ? true : "solo CDMX, Guadalajara y Monterrey" } : { disponible_en_tu_ciudad: false },
    recoger_en_sucursal: ENVIOS.recoger,
    sucursales: SUCURSALES.map((s) => ({ nombre: s.nombre, ciudad: s.ciudad, direccion: s.direccion, horario: s.horario })),
    cambios_y_devoluciones: ENVIOS.cambios,
    formas_de_pago: ENVIOS.pago,
  };
}

export const TOOLS: ToolSpec[] = [
  {
    name: "recomendar_talla",
    description: "Recomienda la talla (XS–XL) de playera, sudadera o pantalón a partir de las medidas del cliente. Úsala en cuanto dé pecho, altura, peso o cintura. Para pantalones lo que manda es la cintura.",
    parameters: { type: "object", properties: {
      pecho_cm: { type: "number", description: "Contorno de pecho en cm" },
      cintura_cm: { type: "number", description: "Contorno de cintura en cm" },
      altura_cm: { type: "number", description: "Altura en cm (1.75 m = 175)" },
      peso_kg: { type: "number", description: "Peso en kg" },
      ajuste: { type: "string", enum: ["oversize", "ajustado"], description: "Cómo la quiere: holgada (por defecto) o más pegada" },
      prenda: { type: "string", enum: ["playera", "sudadera", "pantalon"], description: "Qué prenda es; por defecto playera" },
    } },
  },
  {
    name: "consultar_existencias",
    description: "Cuántas piezas quedan de un diseño por talla y por sucursal (CDMX, Guadalajara, Monterrey) y en bodega para envío.",
    parameters: { type: "object", properties: {
      diseno: { type: "string", description: "Nombre del diseño, p. ej. «Spirit Being»" },
      talla: { type: "string", enum: ["XS", "S", "M", "L", "XL"] },
      sucursal: { type: "string", description: "Sucursal o ciudad, si el cliente la mencionó" },
    }, required: ["diseno"] },
  },
  { name: "listar_disenos", description: "Lista todos los diseños (playeras, sudaderas y pantalones) con color, precio y si están en liquidación.", parameters: { type: "object", properties: {} } },
  {
    name: "info_envios",
    description: "Costos y tiempos de envío, recoger en sucursal, cambios y formas de pago.",
    parameters: { type: "object", properties: { ciudad: { type: "string" }, total_pedido: { type: "number", description: "Total del pedido en MXN, si lo dijo" } } },
  },
];

export function ejecutar(nombre: string, args: Record<string, unknown>): unknown {
  const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : typeof v === "string" && v.trim() && isFinite(Number(v)) ? Number(v) : undefined);
  switch (nombre) {
    case "recomendar_talla": return toolRecomendarTalla({ pecho_cm: num(args.pecho_cm), cintura_cm: num(args.cintura_cm), altura_cm: num(args.altura_cm), peso_kg: num(args.peso_kg), ajuste: String(args.ajuste || ""), prenda: String(args.prenda || "") });
    case "consultar_existencias": return toolExistencias({ diseno: String(args.diseno || ""), talla: args.talla ? String(args.talla) : undefined, sucursal: args.sucursal ? String(args.sucursal) : undefined });
    case "listar_disenos": return toolListarDisenos();
    case "info_envios": return toolEnvios({ ciudad: args.ciudad ? String(args.ciudad) : undefined, total_pedido: num(args.total_pedido) });
    default: return { error: `Herramienta desconocida: ${nombre}` };
  }
}

// ---------- modo por reglas (sin IA, sin costo) ----------
export type Msg = { role: "user" | "assistant"; content: string };

function medidas(textos: string[]) {
  const t = textos.join(" \n ").toLowerCase().replace(/,/g, ".");
  const out: { pecho_cm?: number; altura_cm?: number; peso_kg?: number; cintura_cm?: number } = {};
  const alt = t.match(/(?:mido|altura|estatura|miden?)[^0-9]{0,12}(\d(?:\.\d{1,2})?)\s*m?\b(?!\s*kg)/);
  const m = alt ? Number(alt[1]) : (t.match(/\b(1\.\d{2})\s*(?:m|mts|metros)?\b/) ? Number(t.match(/\b(1\.\d{2})/)![1]) : undefined);
  if (m && m > 1.2 && m < 2.3) out.altura_cm = Math.round(m * 100);
  else { const cm = t.match(/\b(1[4-9]\d|2[01]\d)\s*cm\b/) || t.match(/(?:mido|altura|estatura)[^0-9]{0,8}(1[4-9]\d|2[01]\d)\b/); if (cm) out.altura_cm = Number(cm[1]); }
  const peso = t.match(/(\d{2,3}(?:\.\d)?)\s*(?:kg|kilos?)/) || t.match(/(?:peso|pesa)[^0-9]{0,8}(\d{2,3})\b/);
  if (peso) out.peso_kg = Number(peso[1]);
  const pecho = t.match(/(?:pecho|torax|busto)[^0-9]{0,10}(\d{2,3})/) ;
  if (pecho) out.pecho_cm = Number(pecho[1]);
  const cin = t.match(/cintura[^0-9]{0,10}(\d{2,3})/);
  if (cin) out.cintura_cm = Number(cin[1]);
  return out;
}

const AYUDA = "Puedo ayudarte con:\n• **Tu talla** — dime tu altura y peso, o tu pecho en cm\n• **Existencias** — «¿quedan Spirit Being en M en Monterrey?»\n• **Envíos, cambios y sucursales**\n\n¿Qué necesitas?";

export function responderPorReglas(historial: Msg[]): string {
  const users = historial.filter((m) => m.role === "user").map((m) => m.content);
  const ultimo = users[users.length - 1] || "";
  const q = norm(ultimo);
  const todo = users.join(" ");
  const diseno = buscarDiseno(ultimo) || buscarDiseno(todo);
  const tallaPedida = (ultimo.toUpperCase().match(/\b(XS|XL|S|M|L)\b/) || [])[1];

  if (q.length < 25 && /^(hola|buenas|hey|hi|que tal|buen dia|buenos dias)\b/.test(q)) return "¡Hola! Soy el asistente de BAM! 👋 " + AYUDA;
  // existencias
  if (/(quedan|stock|existenc|disponib|agotad|piezas|\bhay\b|tienen)/.test(q) || (diseno && /(talla|tienda|sucursal|monterrey|guadalajara|cdmx|roma)/.test(q) && !/mido|peso/.test(q))) {
    if (!diseno) return "¿De cuál diseño? Tenemos: " + FAMILIAS.map((f) => f.nombre).join(", ") + ".";
    const r = toolExistencias({ diseno: diseno.nombre, talla: tallaPedida, sucursal: ultimo }) as { existencias_por_talla: Record<string, number | string>[]; precio_vigente: number };
    const filas = r.existencias_por_talla.map((f) => "• **" + f.talla + "** — " + Object.entries(f).filter(([k]) => k !== "talla").map(([k, v]) => `${k.replace("BAM! ", "")}: ${v}`).join(" · "));
    return `**${diseno.nombre}** (${diseno.color}, $${r.precio_vigente}) — piezas disponibles:\n${filas.join("\n")}\n\n«Envío a domicilio» sale de bodega. ¿Te ayudo a elegir talla?`;
  }
  // talla
  const med = medidas(users);
  const prenda = /(pantalon|jean|mezclilla|cargo|denim)/.test(norm(todo)) ? "pantalon" : /(sudadera|hoodie|crewneck|chamarra)/.test(norm(todo)) ? "sudadera" : "playera";
  if (/(talla|medida|mido|peso|pecho|cintura|me queda|me va|oversize|que size)/.test(q) || med.altura_cm || med.pecho_cm) {
    if (!med.altura_cm && !med.pecho_cm && !med.cintura_cm) return "Para recomendarte talla dime tu **altura** y **peso** (por ejemplo «mido 1.75 y peso 72 kg») o tu **pecho en cm**; para pantalones, tu **cintura en cm**. Todo es oversize: tu talla de siempre queda holgada como en las fotos.";
    const r = toolRecomendarTalla({ ...med, prenda, ajuste: /(pegad|ajustad|justa|slim)/.test(q) ? "ajustado" : "oversize" }) as { talla_recomendada?: string; porque?: string; si_la_quieres_mas_pegada?: string; si_la_quieres_mas_holgada?: string; necesito?: string };
    if (!r.talla_recomendada) return r.necesito || AYUDA;
    return `Te recomiendo **${r.talla_recomendada}** (${r.porque}). Es oversize/wide leg, así que queda holgada como en las fotos.\n• Más pegada: **${r.si_la_quieres_mas_pegada}**\n• Más holgada: **${r.si_la_quieres_mas_holgada}**\n\nSi no te convence, el cambio de talla es gratis (15 días). ¿Quieres que revise si hay en alguna sucursal?`;
  }
  // envíos
  if (/(envio|envian|mandan|domicilio|paqueteria|llega|tardan|dias|costo|gratis|recoger|recojo)/.test(q)) {
    return `**Envío a todo México:** $${ENVIOS.costo} (gratis desde $${ENVIOS.gratisDesde}), ${ENVIOS.dias}.\n**Exprés** $${ENVIOS.expres.costo}: ${ENVIOS.expres.dias}.\n**Recoger en sucursal:** gratis — ${ENVIOS.recoger}\n\n¿Me dices tu ciudad y el total de tu pedido y te confirmo?`;
  }
  if (/(cambio|devol|reembolso|no me quedo)/.test(q)) return ENVIOS.cambios;
  if (/(sucursal|tienda|donde|direccion|horario|ubicacion)/.test(q)) return SUCURSALES.map((s) => `📍 **${s.nombre}** (${s.ciudad}) — ${s.direccion}. ${s.horario}`).join("\n");
  if (/(pago|pagar|tarjeta|transferencia|efectivo)/.test(q)) return ENVIOS.pago;
  if (/(precio|cuanto|cuesta|socio|club)/.test(q)) {
    const f = diseno;
    if (f) return `**${f.nombre}**: $${f.liquidacion ?? f.publico} público · **$${f.socio} socios**.`;
    return "Playeras de **$599 a $649**, sudaderas **$899** y pantalones **$1,099** (público); para socios **$499–$549**, **$799** y **$949**. Con 3 o más piezas hay un descuento extra.";
  }
  if (/^(hola|buenas|hey|hi|que tal|buen dia|buenos dias)\b/.test(q)) return "¡Hola! Soy el asistente de BAM! 👋 " + AYUDA;
  return AYUDA;
}
