// Catálogo de la tienda. Los precios están en pesos chilenos (CLP, sin decimales).
// El servidor usa SIEMPRE estos precios al crear el pago: nunca confía en el precio
// que envía el navegador.
//
// Para usar fotos reales, agrega el archivo en public/img/ y define `image`,
// por ejemplo: image: "/img/polera-basica-negra.jpg"
module.exports = [
  { id: "polera-basica", name: "Polera Básica Algodón", category: "mujer", type: "tshirt", color: "#1f2937", price: 12990, sizes: ["XS", "S", "M", "L", "XL"], description: "Polera 100% algodón peinado, corte recto. Hecha en Chile." },
  { id: "vestido-lino", name: "Vestido de Lino Verano", category: "mujer", type: "dress", color: "#c2410c", price: 34990, oldPrice: 42990, sizes: ["S", "M", "L"], description: "Vestido midi de lino, fresco y liviano para el verano." },
  { id: "jeans-mom", name: "Jeans Mom Fit", category: "mujer", type: "pants", color: "#1e40af", price: 29990, sizes: ["36", "38", "40", "42", "44"], description: "Tiro alto, mezclilla rígida con un toque de elasticidad." },
  { id: "chaqueta-cortaviento", name: "Cortaviento Patagonia", category: "hombre", type: "jacket", color: "#065f46", price: 49990, sizes: ["S", "M", "L", "XL"], description: "Cortaviento impermeable con capucha, ideal para el sur." },
  { id: "polera-oversize", name: "Polera Oversize Estampada", category: "hombre", type: "tshirt", color: "#7c2d12", price: 15990, sizes: ["S", "M", "L", "XL", "XXL"], description: "Corte oversize con estampado frontal de la cordillera." },
  { id: "pantalon-cargo", name: "Pantalón Cargo", category: "hombre", type: "pants", color: "#57534e", price: 32990, oldPrice: 37990, sizes: ["40", "42", "44", "46", "48"], description: "Gabardina resistente con bolsillos laterales." },
  { id: "poleron-canguro", name: "Polerón Canguro", category: "unisex", type: "jacket", color: "#6b21a8", price: 27990, sizes: ["XS", "S", "M", "L", "XL"], description: "Polerón de franela perchada con bolsillo canguro." },
  { id: "jockey-bordado", name: "Jockey Bordado", category: "accesorios", type: "cap", color: "#0f766e", price: 9990, sizes: ["Única"], description: "Jockey de gabardina con logo bordado y ajuste trasero." },
  { id: "zapatillas-urbanas", name: "Zapatillas Urbanas", category: "unisex", type: "shoes", color: "#b91c1c", price: 44990, sizes: ["36", "37", "38", "39", "40", "41", "42", "43", "44"], description: "Zapatillas de lona con suela de goma vulcanizada." },
];
