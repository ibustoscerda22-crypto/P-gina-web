require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const {
  MercadoPagoConfig,
  Preference,
  Payment,
  WebhookSignatureValidator,
} = require("mercadopago");
const products = require("./data/products");

const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const SHIPPING_COST = Number(process.env.SHIPPING_COST ?? 3990);
const FREE_SHIPPING_FROM = Number(process.env.FREE_SHIPPING_FROM ?? 50000);
const ORDERS_FILE = path.join(__dirname, "data", "orders.json");

if (!process.env.MP_ACCESS_TOKEN) {
  console.warn("⚠️  Falta MP_ACCESS_TOKEN en .env: el pago con MercadoPago no funcionará.");
}

const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || "" });

// --- Pedidos -------------------------------------------------------------
// Almacenamiento simple en un archivo JSON. Para producción con mucho tráfico
// conviene reemplazarlo por una base de datos (PostgreSQL, MySQL, etc.).
function readOrders() {
  try {
    return JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveOrder(order) {
  const orders = readOrders();
  orders[order.id] = { ...orders[order.id], ...order };
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
  return orders[order.id];
}

function shippingFor(subtotal) {
  return subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_COST;
}

// --- App -----------------------------------------------------------------
const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/products", (_req, res) => {
  res.json({ products, shipping: { cost: SHIPPING_COST, freeFrom: FREE_SHIPPING_FROM } });
});

app.post("/api/checkout", async (req, res) => {
  const { items, customer } = req.body || {};

  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    return res.status(400).json({ error: "El carrito está vacío." });
  }
  if (!customer?.name || !customer?.email || !customer?.address || !customer?.region) {
    return res.status(400).json({ error: "Completa tus datos de despacho." });
  }

  // Reconstruye el carrito con los precios del catálogo del servidor.
  const lines = [];
  for (const item of items) {
    const product = products.find((p) => p.id === item.id);
    const quantity = Number.parseInt(item.quantity, 10);
    if (!product || !product.sizes.includes(item.size) || !(quantity >= 1 && quantity <= 20)) {
      return res.status(400).json({ error: "Hay un producto inválido en el carrito." });
    }
    lines.push({
      id: product.id,
      title: `${product.name} (talla ${item.size})`,
      quantity,
      unit_price: product.price,
      currency_id: "CLP",
    });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0);
  const shipping = shippingFor(subtotal);
  const orderId = crypto.randomUUID();

  try {
    const preference = await new Preference(mp).create({
      body: {
        items: lines,
        shipments: { cost: shipping, mode: "not_specified" },
        payer: { name: String(customer.name).slice(0, 100), email: String(customer.email).slice(0, 150) },
        external_reference: orderId,
        statement_descriptor: "TIENDA ANDES",
        back_urls: {
          success: `${BASE_URL}/resultado.html`,
          failure: `${BASE_URL}/resultado.html`,
          pending: `${BASE_URL}/resultado.html`,
        },
        // MercadoPago solo acepta auto_return con URLs públicas (https), no con localhost.
        ...(BASE_URL.startsWith("https://") && { auto_return: "approved" }),
        notification_url: BASE_URL.startsWith("https://") ? `${BASE_URL}/api/webhook` : undefined,
      },
      requestOptions: { idempotencyKey: orderId },
    });

    saveOrder({
      id: orderId,
      createdAt: new Date().toISOString(),
      status: "pending",
      customer: {
        name: String(customer.name),
        email: String(customer.email),
        phone: String(customer.phone || ""),
        address: String(customer.address),
        commune: String(customer.commune || ""),
        region: String(customer.region),
      },
      items: lines,
      subtotal,
      shipping,
      total: subtotal + shipping,
      preferenceId: preference.id,
    });

    // En modo prueba se usa sandbox_init_point; en producción init_point.
    const isTest = (process.env.MP_ACCESS_TOKEN || "").startsWith("TEST-");
    res.json({ orderId, url: isTest ? preference.sandbox_init_point : preference.init_point });
  } catch (err) {
    console.error("Error creando preferencia:", err?.message || err);
    res.status(502).json({ error: "No pudimos conectar con MercadoPago. Intenta nuevamente." });
  }
});

// MercadoPago avisa aquí cada vez que cambia el estado de un pago.
app.post("/api/webhook", async (req, res) => {
  const dataId = req.query["data.id"] || req.body?.data?.id;
  const type = req.query.type || req.body?.type;

  if (process.env.MP_WEBHOOK_SECRET) {
    try {
      WebhookSignatureValidator.validate({
        xSignature: req.headers["x-signature"],
        xRequestId: req.headers["x-request-id"],
        dataId,
        secret: process.env.MP_WEBHOOK_SECRET,
      });
    } catch (err) {
      console.warn("Webhook con firma inválida:", err.reason || err.message);
      return res.sendStatus(401);
    }
  }

  if (type !== "payment" || !dataId) return res.sendStatus(200);

  try {
    // Nunca confíes en el cuerpo del webhook: consulta el pago directamente a MercadoPago.
    const payment = await new Payment(mp).get({ id: dataId });
    const order = readOrders()[payment.external_reference];
    if (order) {
      saveOrder({
        id: order.id,
        status: payment.status, // approved | pending | in_process | rejected | refunded ...
        paymentId: payment.id,
        paidAmount: payment.transaction_amount,
        updatedAt: new Date().toISOString(),
      });
      console.log(`Pedido ${order.id}: pago ${payment.id} ${payment.status}`);
    }
    res.sendStatus(200);
  } catch (err) {
    console.error("Error procesando webhook:", err?.message || err);
    res.sendStatus(500); // MercadoPago reintentará
  }
});

// Estado de un pedido (lo usa la página de resultado).
app.get("/api/orders/:id", (req, res) => {
  const order = readOrders()[req.params.id];
  if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
  res.json({ id: order.id, status: order.status, total: order.total });
});

app.listen(PORT, () => {
  console.log(`Tienda corriendo en ${BASE_URL} (puerto ${PORT})`);
});
