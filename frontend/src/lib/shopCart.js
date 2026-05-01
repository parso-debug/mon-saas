/**
 * Minimal cart utilities backed by localStorage, scoped per shop slug.
 * Cart item shape: { product_id, name, slug, image, price_cents, qty, variant }
 */
const KEY = (slug) => `shop_cart_${slug}`;

export function readCart(slug) {
  try {
    return JSON.parse(localStorage.getItem(KEY(slug)) || "[]");
  } catch {
    return [];
  }
}

export function writeCart(slug, items) {
  localStorage.setItem(KEY(slug), JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("shopCartUpdate", { detail: { slug } }));
}

function variantKey(variant) {
  if (!variant) return "";
  return Object.entries(variant).sort().map(([k, v]) => `${k}:${v}`).join("|");
}

export function addToCart(slug, product, variant, qty = 1) {
  const items = readCart(slug);
  const vk = variantKey(variant);
  const idx = items.findIndex((it) => it.product_id === product.id && variantKey(it.variant) === vk);
  if (idx >= 0) {
    items[idx].qty += qty;
  } else {
    items.push({
      product_id: product.id,
      name: product.name,
      slug: product.slug,
      image: (product.images || [])[0] || null,
      price_cents: product.price_cents,
      qty,
      variant: variant || null,
    });
  }
  writeCart(slug, items);
}

export function updateQty(slug, index, qty) {
  const items = readCart(slug);
  if (qty <= 0) items.splice(index, 1);
  else items[index].qty = qty;
  writeCart(slug, items);
}

export function removeItem(slug, index) {
  const items = readCart(slug);
  items.splice(index, 1);
  writeCart(slug, items);
}

export function clearCart(slug) {
  writeCart(slug, []);
}

export function cartCount(slug) {
  return readCart(slug).reduce((n, it) => n + it.qty, 0);
}

export function cartSubtotalCents(slug) {
  return readCart(slug).reduce((s, it) => s + it.price_cents * it.qty, 0);
}

export function fmtPrice(cents, currency = "EUR") {
  const n = (cents || 0) / 100;
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(n);
}
