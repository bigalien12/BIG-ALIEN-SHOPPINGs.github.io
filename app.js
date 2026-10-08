const cfg = window.BIG_ALIEN_CONFIG || {};
const ready =
  cfg.SUPABASE_URL &&
  !cfg.SUPABASE_URL.includes("PASTE_") &&
  cfg.SUPABASE_PUBLISHABLE_KEY &&
  !cfg.SUPABASE_PUBLISHABLE_KEY.includes("PASTE_");
let sb = null,
  user = null,
  profile = null,
  products = [],
  cart = JSON.parse(localStorage.getItem("big_alien_cart") || "[]"),
  category = "All",
  query = "";
const $ = (id) => document.getElementById(id);
const money = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG", { maximumFractionDigits: 0 });
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[
        m
      ])
  );
function saveCart() {
  localStorage.setItem("big_alien_cart", JSON.stringify(cart));
  $("cartCount").textContent = cart.reduce((a, x) => a + x.qty, 0);
}
function show(id) {
  [
    "authView",
    "otpView",
    "homeView",
    "productView",
    "cartView",
    "checkoutView",
    "ordersView",
    "profileView",
    "adminView",
  ].forEach((x) => $(x).classList.toggle("hidden", x !== id));
}
function msg(id, t, ok = false) {
  $(id).textContent = t;
  $(id).style.color = ok ? "#147a32" : "#b00020";
}
function imageOrFallback(url) {
  return url || "images/solar-panel.jpg";
}
function renderCats() {
  let cats = ["All", ...new Set(products.map((p) => p.category))];
  $("categories").innerHTML = cats
    .map(
      (c) =>
        `<button class="${c === category ? "active" : ""}" data-cat="${esc( c )}">${esc(c)}</button>`
    )
    .join("");
}
function renderProducts() {
  let list = products.filter(
    (p) =>
      (category === "All" || p.category === category) &&
      (!query ||
        `${p.name} ${p.description} ${p.category}`
          .toLowerCase()
          .includes(query.toLowerCase()))
  );
  $("resultCount").textContent = `${list.length} item(s)`;
  $("productGrid").innerHTML = list.length
    ? list
        .map(
          (p) =>
            `<article class="card"><img src="${esc( imageOrFallback(p.image_url) )}" alt="${esc( p.name )}"><div class="cardBody"><div class="muted">${esc( p.category )}</div><h3>${esc(p.name)}</h3><div class="price">${money( p.price )}</div><div class="muted">${ p.stock > 0 ? p.stock + " in stock" : "Out of stock" }</div><button class="primary" data-product="${p.id}" ${ p.stock < 1 ? "disabled" : "" }>View / Buy</button></div></article>`
        )
        .join("")
    : `<div class="summary"><h3>No products found</h3><p>Try another category or search.</p></div>`;
}
async function loadProducts() {
  if (!sb) return;
  let { data, error } = await sb
    .from("products")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });
  if (error) {
    console.error(error);
    return;
  }
  products = data || [];
  renderCats();
  renderProducts();
}
function productById(id) {
  return products.find((p) => p.id === id);
}
function openProduct(id) {
  let p = productById(id);
  if (!p) return;
  show("productView");
  $("productView").innerHTML = `<div class="productDetail"><div><img src="${esc( imageOrFallback(p.image_url) )}" alt="${esc(p.name)}"></div><div><div class="muted">${esc( p.category )}</div><h1>${esc(p.name)}</h1><div class="price">${money( p.price )}</div><p>${esc(p.description)}</p><p>${ p.stock } available</p><label>Quantity<input id="buyQty" type="number" min="1" max="${ p.stock }" value="1"></label><button class="primary" id="addToCart">Add to Cart</button><button class="secondary" id="buyNow">Buy Now</button></div></div>`;
  $("addToCart").onclick = () => {
    let q = Number($("buyQty").value);
    addCart(p, q);
    show("cartView");
    renderCart();
  };
  $("buyNow").onclick = () => {
    let q = Number($("buyQty").value);
    addCart(p, q);
    show("checkoutView");
    prefillCheckout();
  };
}
function addCart(p, q) {
  let x = cart.find((x) => x.id === p.id);
  if (x) x.qty = Math.min(p.stock, x.qty + q);
  else
    cart.push({
      id: p.id,
      qty: q,
      name: p.name,
      price: p.price,
      image_url: p.image_url,
    });
  saveCart();
}
function renderCart() {
  if (!cart.length) {
    $(
      "cartItems"
    ).innerHTML = `<div class="summary"><h3>Your cart is empty.</h3></div>`;
    $("cartSummary").innerHTML = "";
    return;
  }
  $("cartItems").innerHTML = cart
    .map(
      (x) =>
        `<div class="cartRow"><img src="${esc( imageOrFallback(x.image_url) )}"><div style="flex:1"><b>${esc(x.name)}</b><div>${money(x.price)} × ${ x.qty }</div></div><button class="secondary" data-minus="${ x.id }">−</button><b>${x.qty}</b><button class="secondary" data-plus="${ x.id }">+</button><button class="danger" data-remove="${ x.id }">Remove</button></div>`
    )
    .join("");
  let total = cart.reduce((a, x) => a + x.price * x.qty, 0);
  $("cartSummary").innerHTML = `<h3>Total: ${money( total )}</h3><button class="primary" id="checkoutBtn">Proceed to Checkout</button>`;
}
function prefillCheckout() {
  if (profile) {
    $("coName").value = profile.full_name || "";
    $("coPhone").value = profile.phone || "";
  }
}
async function loadProfile() {
  if (!user) return;
  let { data } = await sb
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  profile = data;
  prefillCheckout();
  $("profileName").value = data?.full_name || "";
  $("profilePhone").value = data?.phone || "";
  const adminBtn = $("adminBtn");
  if (adminBtn) adminBtn.classList.toggle("hidden", data?.role !== "admin");
}
async function submitOrder(e) {
  e.preventDefault();
  if (!cart.length) return msg("checkoutMsg", "Cart is empty.");
  let total = cart.reduce((a, x) => a + x.price * x.qty, 0);
  let payload = {
    user_id: user.id,
    total,
    payment_method: $("coPayment").value,
    payment_status: "pending",
    order_status: "processing",
    customer_name: $("coName").value.trim(),
    customer_phone: $("coPhone").value.trim(),
    delivery_address: $("coAddress").value.trim(),
  };
  let { data: o, error } = await sb
    .from("orders")
    .insert(payload)
    .select()
    .single();
  if (error) return msg("checkoutMsg", error.message);
  let items = cart.map((x) => ({
    order_id: o.id,
    product_id: x.id,
    product_name: x.name,
    product_price: x.price,
    quantity: x.qty,
    image_url: x.image_url,
  }));
  let { error: ie } = await sb.from("order_items").insert(items);
  if (ie) {
    await sb.from("orders").delete().eq("id", o.id);
    return msg("checkoutMsg", ie.message);
  }
  await sb
    .from("shipment_updates")
    .insert({
      order_id: o.id,
      status: "Order received",
      message: "Your order has been received and is being processed.",
    });
  cart = [];
  saveCart();
  msg(
    "checkoutMsg",
    "Order placed successfully.\nCheck My Orders for updates.",
    true
  );
  setTimeout(() => openOrders(), 600);
}
async function openOrders() {
  show("ordersView");
  let { data, error } = await sb
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });
  if (error)
    return ($("ordersList").innerHTML = `<div class="summary">${esc( error.message )}</div>`);
  if (!data?.length)
    return ($(
      "ordersList"
    ).innerHTML = `<div class="summary">No orders yet.</div>`);
  let html = "";
  for (const o of data) {
    let { data: ups } = await sb
      .from("shipment_updates")
      .select("*")
      .eq("order_id", o.id)
      .order("created_at", { ascending: false });
    html += `<div class="orderCard"><b>Order ${o.id.slice( 0, 8 )}</b><p>Total: ${money(o.total)} · Payment: <span class="status">${esc( o.payment_status )}</span> · Status: <span class="status">${esc( o.order_status )}</span></p><p>Tracking: ${esc( o.tracking_number || "Not assigned" )}</p><p>Delivery: ${esc(o.delivery_address)}</p><h4>Shipment updates</h4>${ (ups || []) .map( (u) => `<div>📍 <b>${esc(u.status)}</b> — ${esc( u.message )} <span class="muted">${new Date( u.created_at ).toLocaleString()}</span></div>` ) .join("") || "<div class='muted'>No shipment updates yet.</div>" }</div>`;
  }
  $("ordersList").innerHTML = html;
}
async function openAdmin() {
  if (!user) return;
  let { data } = await sb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (data?.role !== "admin") {
    alert("This account is not an Admin account.");
    return;
  }
  show("adminView");
  loadAdminProducts();
  loadAdminOrders();
}
async function loadAdminProducts() {
  let { data, error } = await sb
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
  if (error)
    return ($("adminProducts").innerHTML = `<div class="summary">${esc( error.message )}</div>`);
  let rows = (data || [])
    .map(
      (p) =>
        `<div class="adminRow"><img src="${esc( imageOrFallback(p.image_url) )}"><div><b>${esc(p.name)}</b><div class="muted">${esc( p.category )}</div></div><div>${money(p.price)}</div><div>${p.stock}</div><div>${ p.active ? "Live" : "Hidden" }</div><div><button class="secondary" data-edit="${ p.id }">Edit</button> <button class="danger" data-delete="${ p.id }">Delete</button></div></div>`
    )
    .join("");
  $(
    "adminProducts"
  ).innerHTML = `<div class="adminTable"><div class="adminRow"><b>Image</b><b>Product</b><b>Price</b><b>Stock</b><b>Status</b><b>Actions</b></div>${rows}</div>`;
}
async function loadAdminOrders() {
  let { data, error } = await sb
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });
  if (error)
    return ($("adminOrders").innerHTML = `<div class="summary">${esc( error.message )}</div>`);
  $("adminOrders").innerHTML =
    (data || [])
      .map(
        (o) =>
          `<div class="orderCard"><b>Order ${o.id.slice(0, 8)}</b><p>${esc( o.customer_name )} · ${esc(o.customer_phone)} · ${money( o.total )}</p><p>Payment: <span class="status">${esc( o.payment_status )}</span> · Shipment: <span class="status">${esc( o.order_status )}</span></p><p>Address: ${esc( o.delivery_address )}</p><button class="primary" data-order="${ o.id }">Manage Order</button></div>`
      )
      .join("") || `<div class="summary">No orders.</div>`;
}
function openProductModal(p = null) {
  $("productModalTitle").textContent = p ? "Edit Product" : "Add Product";
  $("productId").value = p?.id || "";
  $("productName").value = p?.name || "";
  $("productCategory").value = p?.category || "Solar";
  $("productPrice").value = p?.price || "";
  $("productStock").value = p?.stock ?? 0;
  $("productDescription").value = p?.description || "";
  $("imagePreview").innerHTML = p?.image_url
    ? `<img class="preview" src="${esc(p.image_url)}">`
    : "";
  $("productImage").value = "";
  $("productMsg").textContent = "";
  $("productModal").classList.remove("hidden");
}
async function saveProduct(e) {
  e.preventDefault();
  let id = $("productId").value;
  let imageUrl = null;
  let file = $("productImage").files[0];
  if (file) {
    let ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    let path = `${crypto.randomUUID()}.${ext}`;
    let { error: up } = await sb.storage
      .from("product-images")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (up) return msg("productMsg", up.message);
    let { data } = sb.storage.from("product-images").getPublicUrl(path);
    imageUrl = data.publicUrl;
  }
  let payload = {
    name: $("productName").value.trim(),
    category: $("productCategory").value,
    price: Number($("productPrice").value),
    stock: Number($("productStock").value),
    description: $("productDescription").value.trim(),
  };
  if (imageUrl) payload.image_url = imageUrl;
  let res = id
    ? await sb.from("products").update(payload).eq("id", id)
    : await sb.from("products").insert(payload);
  if (res.error) return msg("productMsg", res.error.message);
  $("productModal").classList.add("hidden");
  await loadProducts();
  await loadAdminProducts();
}
async function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;
  let { error } = await sb.from("products").delete().eq("id", id);
  if (error) return alert(error.message);
  await loadProducts();
  loadAdminProducts();
}
async function manageOrder(id) {
  let { data: o } = await sb.from("orders").select("*").eq("id", id).single();
  let { data: ups } = await sb
    .from("shipment_updates")
    .select("*")
    .eq("order_id", id)
    .order("created_at", { ascending: false });
  $("orderModalBody").innerHTML = `<h2>Manage Order ${id.slice( 0, 8 )}</h2><p>${esc(o.customer_name)} · ${esc(o.customer_phone)}</p><p>${esc( o.delivery_address )}</p><label>Payment status<select id="mPay"><option ${ o.payment_status === "pending" ? "selected" : "" }>pending</option><option ${ o.payment_status === "paid" ? "selected" : "" }>paid</option><option ${ o.payment_status === "failed" ? "selected" : "" }>failed</option><option ${ o.payment_status === "refunded" ? "selected" : "" }>refunded</option></select></label><label>Shipment status<select id="mStatus">${[ "processing", "confirmed", "shipped", "out_for_delivery", "delivered", "cancelled", ] .map( (s) => `<option ${o.order_status === s ? "selected" : ""}>${s}</option>` ) .join( "" )}</select></label><label>Tracking number<input id="mTrack" value="${esc( o.tracking_number || "" )}"></label><label>Shipment message<textarea id="mMessage" placeholder="e.g. Package has left Abuja sorting centre"></textarea></label><label>Location<input id="mLocation" placeholder="e.g. Abuja"></label><button class="primary" id="saveOrder">Save Update</button><h3>History</h3>${( ups || [] ) .map( (u) => `<div>📍 <b>${esc(u.status)}</b> — ${esc(u.message)} (${new Date( u.created_at ).toLocaleString()})</div>` ) .join("")}`;
  $("saveOrder").onclick = async () => {
    let pay = $("mPay").value,
      status = $("mStatus").value,
      track = $("mTrack").value.trim();
    let { error } = await sb
      .from("orders")
      .update({
        payment_status: pay,
        order_status: status,
        tracking_number: track || null,
      })
      .eq("id", id);
    if (error) return alert(error.message);
    if ($("mMessage").value.trim()) {
      await sb
        .from("shipment_updates")
        .insert({
          order_id: id,
          status,
          message: $("mMessage").value.trim(),
          location: $("mLocation").value.trim() || null,
        });
    }
    $("orderModal").classList.add("hidden");
    loadAdminOrders();
  };
  $("orderModal").classList.remove("hidden");
}
async function init() {
  if (!ready) {
    show("authView");
    msg(
      "authMsg",
      "The site is not connected to Supabase yet.\nAdd the URL and publishable key in config.js."
    );
    return;
  }
  sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
  let { data } = await sb.auth.getSession();
  user = data.session?.user || null;
  if (user) {
    await loadProfile();
    show("homeView");
    await loadProducts();
  } else show("authView");
  sb.auth.onAuthStateChange(async (_e, s) => {
    user = s?.user || null;
    if (user) {
      await loadProfile();
      show("homeView");
      await loadProducts();
    } else show("authView");
  });
}
document.addEventListener("click", async (e) => {
  let t = e.target;
  if (t.dataset.view === "home") {
    e.preventDefault();
    show("homeView");
    renderProducts();
  }
  if (t.dataset.cat) {
    category = t.dataset.cat;
    renderCats();
    renderProducts();
  }
  if (t.dataset.product) openProduct(t.dataset.product);
  if (t.id === "cartBtn") {
    show("cartView");
    renderCart();
  }
  if (t.id === "accountBtn") {
    show("profileView");
    loadProfile();
  }
  if (t.id === "adminBtn") {
    openAdmin();
  }
  if (t.id === "checkoutBtn") {
    show("checkoutView");
    prefillCheckout();
  }
  if (t.dataset.minus) {
    let x = cart.find((x) => x.id === t.dataset.minus);
    if (x) {
      x.qty = Math.max(1, x.qty - 1);
      saveCart();
      renderCart();
    }
  }
  if (t.dataset.plus) {
    let x = cart.find((x) => x.id === t.dataset.plus),
      p = productById(t.dataset.plus);
    if (x && p) x.qty = Math.min(p.stock, x.qty + 1);
    saveCart();
    renderCart();
  }
  if (t.dataset.remove) {
    cart = cart.filter((x) => x.id !== t.dataset.remove);
    saveCart();
    renderCart();
  }
  if (t.dataset.edit) {
    let { data } = await sb
      .from("products")
      .select("*")
      .eq("id", t.dataset.edit)
      .single();
    openProductModal(data);
  }
  if (t.dataset.delete) deleteProduct(t.dataset.delete);
  if (t.dataset.order) manageOrder(t.dataset.order);
  if (t.dataset.close) $(t.dataset.close).classList.add("hidden");
  if (t.dataset.auth) {
    document
      .querySelectorAll("[data-auth]")
      .forEach((x) =>
        x.classList.toggle("active", x.dataset.auth === t.dataset.auth)
      );
    $("loginForm").classList.toggle("hidden", t.dataset.auth !== "login");
    $("signupForm").classList.toggle("hidden", t.dataset.auth !== "signup");
  }
  if (t.dataset.adminTab) {
    $("adminProductsTab").classList.toggle(
      "hidden",
      t.dataset.adminTab !== "products"
    );
    $("adminOrdersTab").classList.toggle(
      "hidden",
      t.dataset.adminTab !== "orders"
    );
    document
      .querySelectorAll("[data-admin-tab]")
      .forEach((x) =>
        x.classList.toggle("active", x.dataset.adminTab === t.dataset.adminTab)
      );
  }
});
$("loginForm").onsubmit = async (e) => {
  e.preventDefault();
  let { error } = await sb.auth.signInWithPassword({
    email: $("loginEmail").value,
    password: $("loginPassword").value,
  });
  if (error) msg("authMsg", error.message);
};
let pendingOtpEmail = "",
  otpTimer = null;
function startOtpTimer(seconds = 60) {
  clearInterval(otpTimer);
  let left = seconds,
    btn = $("resendOtpBtn");
  btn.disabled = true;
  btn.textContent = `Resend OTP in ${left}s`;
  otpTimer = setInterval(() => {
    left--;
    if (left <= 0) {
      clearInterval(otpTimer);
      btn.disabled = false;
      btn.textContent = "Resend OTP";
    } else btn.textContent = `Resend OTP in ${left}s`;
  }, 1000);
}
async function openOtp(email) {
  pendingOtpEmail = email;
  $("otpEmail").textContent = email;
  $("otpCode").value = "";
  $("otpMsg").textContent = "";
  show("otpView");
  startOtpTimer(60);
  setTimeout(() => $("otpCode").focus(), 100);
}
$("signupForm").onsubmit = async (e) => {
  e.preventDefault();
  let email = $("signupEmail").value.trim().toLowerCase(),
    password = $("signupPassword").value;
  let { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: $("signupName").value, phone: $("signupPhone").value },
    },
  });
  if (error) return msg("authMsg", error.message);
  if (data.session) {
    await loadProfile();
    show("homeView");
    await loadProducts();
    return;
  }
  await openOtp(email);
};
$("otpForm").onsubmit = async (e) => {
  e.preventDefault();
  let token = $("otpCode").value.trim();
  if (!/^\d{6}$/.test(token))
    return msg("otpMsg", "Enter the 6-digit verification code.");
  let { data, error } = await sb.auth.verifyOtp({
    email: pendingOtpEmail,
    token,
    type: "signup",
  });
  if (error) return msg("otpMsg", error.message);
  msg("otpMsg", "Email verified successfully.", true);
  user = data.user || data.session?.user || user;
  await loadProfile();
  show("homeView");
  await loadProducts();
};
$("resendOtpBtn").onclick = async () => {
  if (!pendingOtpEmail) return;
  let { error } = await sb.auth.resend({
    type: "signup",
    email: pendingOtpEmail,
  });
  if (error) return msg("otpMsg", error.message);
  msg("otpMsg", "A new verification code has been sent.", true);
  startOtpTimer(60);
};
$("otpBackBtn").onclick = () => {
  show("authView");
  document
    .querySelectorAll("[data-auth]")
    .forEach((x) => x.classList.toggle("active", x.dataset.auth === "signup"));
  $("loginForm").classList.add("hidden");
  $("signupForm").classList.remove("hidden");
};
$("searchBtn").onclick = () => {
  query = $("search").value;
  show("homeView");
  renderProducts();
};
$("search").oninput = () => {
  query = $("search").value;
  renderProducts();
};
$("checkoutForm").onsubmit = submitOrder;
$("profileForm").onsubmit = async (e) => {
  e.preventDefault();
  let { error } = await sb
    .from("profiles")
    .update({
      full_name: $("profileName").value.trim(),
      phone: $("profilePhone").value.trim(),
    })
    .eq("id", user.id);
  msg("profileMsg", error?.message || "Profile saved.", !error);
  if (!error) loadProfile();
};
$("logoutBtn").onclick = () => sb.auth.signOut();
$("productForm").onsubmit = saveProduct;
$("addProductBtn").onclick = () => openProductModal();
$("adminLogout").onclick = () => show("homeView");
document.querySelector(".brand").addEventListener("click", (e) => {
  e.preventDefault();
  show("homeView");
});
saveCart();
init();
