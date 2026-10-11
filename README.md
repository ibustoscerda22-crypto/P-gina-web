# Tienda Andes: tienda de ropa online para Chile

Tienda online con catálogo, carrito, despacho a regiones y pago con **MercadoPago Checkout Pro**
(débito, crédito, cuotas y prepago).

## Estructura

```
server.js            Servidor Express: catálogo, creación del pago y webhook de MercadoPago
data/products.js     Catálogo (nombre, precio en CLP, tallas, categoría, foto)
data/orders.json     Pedidos (se crea solo; en producción conviene una base de datos)
public/              Sitio: index.html, app.js, styles.css, resultado.html, terminos.html
```

## Cómo correrla en tu computador

1. Instala [Node.js](https://nodejs.org) 18 o superior.
2. `npm install`
3. Copia `.env.example` como `.env` y pega tus credenciales **de prueba** de MercadoPago
   (https://www.mercadopago.cl/developers/panel/app → crea una aplicación → "Credenciales de prueba").
4. `npm start` y abre http://localhost:3000

Para probar pagos usa las [tarjetas de prueba de MercadoPago Chile](https://www.mercadopago.cl/developers/es/docs/checkout-pro/additional-content/your-integrations/test/cards).

## Personalizar

- **Productos y precios:** edita `data/products.js`. Para usar fotos reales, guárdalas en `public/img/`
  y agrega `image: "/img/mi-foto.jpg"` al producto.
- **Nombre, RUT, correo:** busca "Tienda Andes" en `public/` y reemplázalo.
- **Costo de envío:** `SHIPPING_COST` y `FREE_SHIPPING_FROM` en `.env`.

## Cómo funciona el pago

1. El cliente llena el carrito y sus datos de despacho.
2. El servidor recalcula el total **con los precios del catálogo** (nunca con los del navegador) y crea
   una "preferencia" en MercadoPago.
3. El cliente paga en MercadoPago y vuelve a `resultado.html`.
4. MercadoPago avisa al webhook `/api/webhook`. El servidor consulta el pago y marca el pedido como
   `approved`, `rejected`, etc. en `data/orders.json`. **Despacha solo pedidos `approved`.**

## Publicar en producción

1. En MercadoPago activa las **credenciales de producción** (te pedirán datos de la empresa y una cuenta bancaria).
2. Configura en el hosting las variables de `.env` con las credenciales `APP_USR-...` y
   `BASE_URL=https://tudominio.cl`.
3. En MercadoPago → Tus integraciones → **Webhooks**, registra `https://tudominio.cl/api/webhook`
   con el evento "Pagos" y copia la clave secreta en `MP_WEBHOOK_SECRET`.
4. Haz una compra real de bajo monto para verificar todo el flujo.
