const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" });
const $ = (sel) => document.querySelector(sel);

let products = [];
let shipping = { cost: 0, freeFrom: Infinity };
let cart = loadCart();

// Ilustraciones simples para mostrar mientras no haya fotos reales.
const SHAPES = {
  tshirt: '<path d="M70 40 100 30q20 18 40 0l30 10 25 35-25 15-10-10v100H75V80L65 90 40 75z"/>',
  dress: '<path d="M95 30h50l-5 30 15 20 20 110H65L85 80l15-20z"/>',
  pants: '<path d="M80 35h80l10 160h-35l-15-110-15 110H70z"/>',
  jacket: '<path d="M90 30h60l35 20 15 70-20 5-10-35v100H70V90l-10 35-20-5 15-70zM120 35v155"/><path d="M100 30q20 30 40 0" fill="none" stroke="#0002" stroke-width="4"/>',
  cap: '<path d="M60 130q0-70 70-70t70 70zM60 130h140l20 15H60z"/>',
  shoes: '<path d="M40 150v-50q30 0 50-20l30 25q40 10 80 15 20 5 20 30v10H40z"/>',
};

function illustration(p) {
  if (p.image) return `<img src="${p.image}" alt="${p.name}" loading="lazy">`;
  return `<svg viewBox="0 0 240 220" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${p.name}"><rect width="240" height="220" fill="${p.color}22"/><g fill="${p.color}">${SHAPES[p.type] || ""}</g></svg>`;
}

function loadCart() {
  try { return JSON.parse(localStorage.getItem("cart")) || []; } catch { return []; }
}
function saveCart() {
  try { localStorage.setItem("cart", JSON.stringify(cart)); } catch {}
  renderCart();
}

async function init() {
  $("#year").textContent = new Date().getFullYear();
  const res = await fetch("/api/products");
  const data = await res.json();
  products = data.products;
  shipping = data.shipping;
  $("#free-from").textContent = clp.format(shipping.freeFrom);
  // Descarta del carrito productos que ya no existan.
  cart = cart.filter((i) => products.some((p) => p.id === i.id));
  renderProducts("todo");
  renderCart();
}

function renderProducts(category) {
  const list = category === "todo" ? products : products.filter((p) => p.category === category);
  $("#products").innerHTML = list.map((p) => `
    <article class="card" data-id="${p.id}">
      <div class="card-img">${illustration(p)}${p.oldPrice ? '<span class="tag">Oferta</span>' : ""}</div>
      <div class="card-info">
        <h3>${p.name}</h3>
        <p class="price">${clp.format(p.price)} ${p.oldPrice ? `<s>${clp.format(p.oldPrice)}</s>` : ""}</p>
        <p class="installments">Hasta 3 cuotas sin interés</p>
      </div>
    </article>`).join("");
}

function openProduct(id) {
  const p = products.find((x) => x.id === id);
  $("#product-detail").innerHTML = `
    <div class="detail-img">${illustration(p)}</div>
    <div class="detail-info">
      <h2>${p.name}</h2>
      <p class="price">${clp.format(p.price)} ${p.oldPrice ? `<s>${clp.format(p.oldPrice)}</s>` : ""}</p>
      <p>${p.description}</p>
      <p class="label">Talla</p>
      <div class="sizes">${p.sizes.map((s, i) => `<label><input type="radio" name="size" value="${s}" ${i === 0 ? "checked" : ""}><span>${s}</span></label>`).join("")}</div>
      <button class="btn" id="add-btn">Agregar al carrito</button>
    </div>`;
  $("#add-btn").onclick = () => {
    const size = document.querySelector('input[name="size"]:checked').value;
    addToCart(p.id, size);
    $("#product-modal").close();
    openCart();
  };
  $("#product-modal").showModal();
}

function addToCart(id, size) {
  const line = cart.find((i) => i.id === id && i.size === size);
  if (line) line.quantity = Math.min(line.quantity + 1, 20);
  else cart.push({ id, size, quantity: 1 });
  saveCart();
}

function totals() {
  const subtotal = cart.reduce((sum, i) => sum + products.find((p) => p.id === i.id).price * i.quantity, 0);
  const ship = subtotal === 0 || subtotal >= shipping.freeFrom ? 0 : shipping.cost;
  return { subtotal, ship, total: subtotal + ship };
}

function renderCart() {
  $("#cart-count").textContent = cart.reduce((n, i) => n + i.quantity, 0);
  if (!products.length) return;

  if (cart.length === 0) {
    $("#cart-items").innerHTML = '<p class="empty">Tu carrito está vacío.</p>';
    $("#cart-summary").innerHTML = "";
    $("#checkout-form").hidden = true;
    return;
  }

  $("#cart-items").innerHTML = cart.map((i, idx) => {
    const p = products.find((x) => x.id === i.id);
    return `
      <div class="cart-line">
        <div class="thumb">${illustration(p)}</div>
        <div class="cart-line-info">
          <strong>${p.name}</strong>
          <small>Talla ${i.size}</small>
          <div class="qty">
            <button data-act="dec" data-idx="${idx}">−</button>
            <span>${i.quantity}</span>
            <button data-act="inc" data-idx="${idx}">+</button>
            <button class="remove" data-act="del" data-idx="${idx}">Eliminar</button>
          </div>
        </div>
        <span>${clp.format(p.price * i.quantity)}</span>
      </div>`;
  }).join("");

  const t = totals();
  const missing = shipping.freeFrom - t.subtotal;
  $("#cart-summary").innerHTML = `
    <div><span>Subtotal</span><span>${clp.format(t.subtotal)}</span></div>
    <div><span>Despacho</span><span>${t.ship ? clp.format(t.ship) : "Gratis"}</span></div>
    ${missing > 0 ? `<p class="hint">Te faltan ${clp.format(missing)} para envío gratis</p>` : ""}
    <div class="total"><span>Total</span><span>${clp.format(t.total)}</span></div>`;
  $("#checkout-form").hidden = false;
}

function openCart() {
  $("#cart").classList.add("open");
  $("#cart").setAttribute("aria-hidden", "false");
  $("#overlay").classList.add("show");
}
function closeCart() {
  $("#cart").classList.remove("open");
  $("#cart").setAttribute("aria-hidden", "true");
  $("#overlay").classList.remove("show");
}

// --- Eventos -------------------------------------------------------------
$("#filters").addEventListener("click", (e) => {
  if (e.target.tagName !== "BUTTON") return;
  document.querySelectorAll("#filters button").forEach((b) => b.classList.toggle("active", b === e.target));
  renderProducts(e.target.dataset.cat);
});

$("#products").addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (card) openProduct(card.dataset.id);
});

$("#cart-items").addEventListener("click", (e) => {
  const { act, idx } = e.target.dataset;
  if (!act) return;
  const line = cart[idx];
  if (act === "inc") line.quantity = Math.min(line.quantity + 1, 20);
  if (act === "dec") line.quantity -= 1;
  if (act === "del" || line.quantity <= 0) cart.splice(idx, 1);
  saveCart();
});

$("#open-cart").onclick = openCart;
$("#close-cart").onclick = closeCart;
$("#overlay").onclick = closeCart;

$("#checkout-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#pay-btn");
  const error = $("#form-error");
  error.textContent = "";
  btn.disabled = true;
  btn.textContent = "Redirigiendo a MercadoPago…";

  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart, customer: Object.fromEntries(new FormData(e.target)) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al iniciar el pago");
    try { localStorage.setItem("lastOrder", data.orderId); } catch {}
    window.location.href = data.url;
  } catch (err) {
    error.textContent = err.message;
    btn.disabled = false;
    btn.textContent = "Pagar con MercadoPago";
  }
});

init().catch(() => {
  $("#products").innerHTML = '<p class="empty">No pudimos cargar los productos. Recarga la página.</p>';
});
