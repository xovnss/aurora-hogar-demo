# BAM! — demo

Tienda de ropa y accesorios con mensaje (**«a brand made for you»**) con catálogo, fichas de ventas
y un **chatbot de ayuda**. Es una demo: los datos son de ejemplo (sucursales, existencias y precios
inventados); las 11 playeras y las fotos son del catálogo real de la marca.

## Cómo correrla

```bash
npm install
npm run dev
```

Y se abre en `http://localhost:3000`.

| Pantalla | Dirección | Contraseña |
|---|---|---|
| Catálogo | `/` | — |
| Fichas para ventas | `/ventas` | `demo` |
| Subir productos | `/subir` | usuario `Ana` o `Luis`, contraseña `demo`, PIN `1234` (todo en memoria, se reinicia) |

## El chatbot

Botón flotante en el catálogo. Ayuda a:

- **Elegir talla** a partir de pecho, o altura y peso (las playeras son oversize; sugiere también una talla más pegada o más holgada).
- **Ver cuántas piezas quedan** de cada diseño, por talla y por sucursal (CDMX, Guadalajara, Monterrey) y en bodega.
- **Envíos, recoger en sucursal, cambios y formas de pago.**

Cómo funciona (`src/app/api/chat/route.ts` + `src/lib/chat-tools.ts`):

- Con `OPENROUTER_API_KEY` usa un modelo de IA (por defecto `openai/gpt-4o-mini`, se cambia con `OPENROUTER_MODEL`) con *function calling*: el modelo llama a las herramientas `recomendar_talla`, `consultar_existencias`, `listar_disenos` e `info_envios`, y redacta con lo que regresan, sin inventar cifras.
- Sin llave, o si el proveedor falla, responde **por reglas** (sin costo y sin red).
- Protecciones: máximo de mensajes y de largo, límite de peticiones por IP, tope diario de llamadas al modelo (`CHAT_DAILY_LLM_CAP`) y tiempo límite. Sobre una instancia serverless estos topes son por instancia; la protección real es el límite de crédito de la llave.

## Qué se cambia

| Qué | Dónde |
|---|---|
| Diseños, precios, colores y tallas | `src/lib/demo-datos.ts` → `FAMILIAS` |
| Guía de tallas, sucursales y envíos | `src/lib/tallas.ts` |
| Nombre y colores de la marca | `src/lib/config.ts`, `src/app/globals.css` |
| Logos y fotos | `public/` |

## Variables de entorno

Ver `.env.example`. La llave de IA **nunca** se guarda en el repo: se agrega en el panel de Vercel.
