# Aurora Hogar — demo

Plataforma de catálogo, fichas de ventas y caja para una tienda, en versión de demostración **sin datos reales**. El diseño, las pantallas y los
flujos son los mismos; lo único que cambió es de dónde salen los datos.

- **No se conecta a Odoo.** No hay credenciales, no hay inventario real, no hay ventas de nadie.
- **No hay fotos reales.** Cada producto dibuja un cuadro de ejemplo con su nombre.
- **La marca es inventada** ("Aurora Hogar"), igual que los productos y los precios.

## Cómo correrla

```bash
npm install
npm run dev
```

Y se abre en `http://localhost:3000`.

| Pantalla | Dirección | Contraseña |
|---|---|---|
| Catálogo (el de las clientas) | `/` | — |
| Fichas para ventas | `/ventas` | `demo` |
| Corte de caja | `/caja` | `demo` |

Las contraseñas se cambian en `.env.local` (hay un `.env.example` de partida).

## Qué se puede enseñar

**Catálogo:** secciones y subcategorías, buscador, filtros por medida y por precio, ficha con
selector de color y medida, precio público y de socios, "Mi lista" y el pedido por WhatsApp.

**Fichas:** buscador, ficha con todos los colores, cotización y el **catálogo de etiqueta
blanca** en PDF (media hoja por producto, con índice y portada).

**Caja:** arqueo billete por billete, entradas y salidas con su vale, cuadre contra lo que
"registró el punto de venta", envíos por cobrar y el ticket del corte.

## Qué se cambia para que se vea distinto

| Qué | Dónde |
|---|---|
| Productos, precios, colores y medidas | `src/lib/demo-datos.ts` → la lista `FAMILIAS` |
| Nombre de la tienda | `src/lib/config.ts` → `SITE.name` |
| Logo | `public/aurora.png` (fondo claro), `public/aurora-blanco.png` (fondo oscuro) y `public/temas/normal/logo.png` |
| WhatsApp del pedido | `.env.local` → `NEXT_PUBLIC_WHATSAPP` |

## Cómo está hecha por dentro

Las pantallas **no se tocaron**: siguen pidiendo los datos con las mismas funciones de
siempre. Lo que se cambió son los dos archivos que antes hablaban con Odoo:

- `src/lib/odoo.ts` → ahora arma el catálogo desde `demo-datos.ts`.
- `src/lib/odoo-write.ts` → ahora guarda los arqueos y los cobros **en memoria**.
- `src/app/img/route.ts` → ahora dibuja el cuadro de ejemplo en vez de traer la foto.

Por eso lo que se capture en la app de caja **dura mientras el servidor esté encendido** y se
borra al reiniciarlo. Para una demo es lo que conviene: siempre empieza limpia.

La agrupación de productos en familias, la búsqueda, los temas, los PDF y todo lo demás es
el código de la plataforma completa; solo la fuente de datos es de ejemplo.
