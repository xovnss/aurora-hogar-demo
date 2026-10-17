// Precio por volumen: al llevar >= qty piezas, cada una cuesta price (ej. 2×$100, 3×$80, 5×$60)
export type Tarifa = { qty: number; price: number };

export type Product = {
  id: number;
  sku: string;
  name: string;
  catalogo: string;      // sección (Playeras…)
  categoria: string;     // subcategoría (Estampado al frente / en la espalda)
  precioPublico: number;
  precioMiembro: number | null;
  precioLiquidacion: number | null;
  tarifas: Tarifa[];           // precios por volumen (0 a 3 escalones)
  stock: number;               // VENDIBLE = físico − apartado (pedidos confirmados + cotizaciones)
  stockTienda: number;         // vendible sumando todas las sucursales
  stockBodega: number;         // vendible en la bodega (envíos a domicilio)
  stockSucursal?: Record<string, number>; // vendible por sucursal (clave = id de SUCURSALES)
  fisico: number;              // piezas en el almacén, incluidas las apartadas
  apartado: number;            // piezas ya comprometidas con una clienta
  imageUrl: string | null;      // foto grande (ficha) — por nuestro dominio
  thumbUrl: string | null;      // miniatura para las tarjetas (10× más ligera)
  imagenes: string[];          // fotos adicionales (galería)
  descripcion: string | null;
  tags: number[];              // ids de product.tag (temporada: Navidad, Halloween…)
};
