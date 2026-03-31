// ═══════════════════════════════════════════════════════════════
//  NEON POS — app.js  (ES6+ Module, Firebase + Offline-First)
// ═══════════════════════════════════════════════════════════════

// ── Firebase Configuration ──────────────────────────────────────
// ⚠️  REPLACE WITH YOUR OWN FIREBASE CONFIG BELOW
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCZY6enddBPhwtwHBmM6IFyXNktEeJA_NA",
  authDomain: "posapp-43d9c.firebaseapp.com",
  projectId: "posapp-43d9c",
  storageBucket: "posapp-43d9c.firebasestorage.app",
  messagingSenderId: "125295606758",
  appId: "1:125295606758:web:2b9b74de93b2ec7dc5b427",
  measurementId: "G-NX7FF55FC2"
};
// Firebase Realtime Database অফলাইন পারসিস্টেন্স এবং সিঙ্কিং চালু করা
import { ref, keepSynced } from "firebase/database";

// ১. প্রোডাক্ট লিস্ট অফলাইনে সেভ রাখার জন্য
const productsRef = ref(db, 'products');
keepSynced(productsRef, true); 

// ২. বিক্রয়ের হিসাব (Sales) অফলাইনে সেভ রাখার জন্য
const salesRef = ref(db, 'sales');
keepSynced(salesRef, true);

// ৩. ইনভেন্টরি লগ বা অন্য কিছু থাকলে সেগুলোও একইভাবে যোগ করুন
// ── Initialize Firebase ─────────────────────────────────────────
const app = firebase.initializeApp(firebaseConfig);
const db  = firebase.database();

// ── App State ───────────────────────────────────────────────────
let products   = {};    // Firebase snapshot of products
let sales      = [];    // Firebase snapshot of sales
let cart       = [];    // Active cart
let pendingKey = null;  // Product key being deleted
const LOW_STOCK_THRESHOLD = 5;
const VAT_RATE = 0.15;

// ── Offline Queue (localStorage fallback) ───────────────────────
function getOfflineQueue() {
  try { return JSON.parse(localStorage.getItem('neonpos_offline_queue') || '[]'); }
  catch { return []; }
}
function saveOfflineQueue(q) {
  localStorage.setItem('neonpos_offline_queue', JSON.stringify(q));
}
function addToOfflineQueue(saleData) {
  const q = getOfflineQueue();
  q.push({ ...saleData, queuedAt: Date.now() });
  saveOfflineQueue(q);
  updateOfflineQueueUI();
}
async function flushOfflineQueue() {
  const q = getOfflineQueue();
  if (!q.length) return;
  showSyncIndicator(true);
  for (const saleData of q) {
    try {
      await commitSaleToFirebase(saleData);
    } catch (e) {
      console.warn('Flush failed for sale:', e);
      showSyncIndicator(false);
      return;
    }
  }
  saveOfflineQueue([]);
  updateOfflineQueueUI();
  showSyncIndicator(false);
  showToast('Offline sales synced to Firebase', 'success');
}
function updateOfflineQueueUI() {
  const q     = getOfflineQueue();
  const panel = document.getElementById('offline-queue-panel');
  const count = document.getElementById('offline-queue-count');
  if (q.length > 0) {
    panel.classList.remove('hidden');
    count.textContent = q.length + ' pending';
  } else {
    panel.classList.add('hidden');
  }
}

// ── Network Status ───────────────────────────────────────────────
let isOnline = navigator.onLine;
function updateNetworkStatus(online) {
  isOnline = online;
  const badge = document.getElementById('status-badge');
  const dot   = document.getElementById('status-dot');
  const text  = document.getElementById('status-text');
  badge.className = 'flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono transition-all duration-500 ' +
    (online ? 'status-online' : 'status-offline');
  dot.className   = 'w-2 h-2 rounded-full ' + (online ? 'bg-cyber-green' : 'bg-cyber-red');
  text.textContent = online ? 'ONLINE' : 'OFFLINE';
  if (online) flushOfflineQueue();
}
window.addEventListener('online',  () => updateNetworkStatus(true));
window.addEventListener('offline', () => updateNetworkStatus(false));
updateNetworkStatus(navigator.onLine);

function showSyncIndicator(show) {
  const el = document.getElementById('sync-indicator');
  el.style.display = show ? 'flex' : 'none';
}

// ── Tab Switching ────────────────────────────────────────────────
function switchTab(name) {
  ['dashboard','pos','inventory'].forEach(t => {
    document.getElementById('tab-content-' + t).classList.toggle('hidden', t !== name);
    ['tab-'+t, 'tab-'+t+'-m'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('active', t === name);
    });
  });
}
window.switchTab = switchTab;

// ── Firebase Listeners ───────────────────────────────────────────
db.ref('products').on('value', snap => {
  products = snap.val() || {};
  renderInventoryTable();
  renderPOSGrid();
  updateDashboard();
});

db.ref('sales').on('value', snap => {
  const raw = snap.val() || {};
  sales = Object.entries(raw).map(([k,v]) => ({ key: k, ...v }));
  sales.sort((a,b) => b.timestamp - a.timestamp);
  updateDashboard();
});

// ── Dashboard ────────────────────────────────────────────────────
function updateDashboard() {
  let revenue = 0, profit = 0;
  sales.forEach(s => {
    revenue += (s.total || 0);
    profit  += (s.profit || 0);
  });

  document.getElementById('kpi-revenue').textContent = '৳' + revenue.toFixed(2);
  document.getElementById('kpi-profit').textContent  = '৳' + profit.toFixed(2);
  document.getElementById('kpi-sales').textContent   = sales.length;

  const lowItems = Object.values(products).filter(p => p.stock <= LOW_STOCK_THRESHOLD);
  document.getElementById('kpi-lowstock').textContent = lowItems.length;

  const lsEl = document.getElementById('low-stock-list');
  if (lowItems.length === 0) {
    lsEl.innerHTML = '<p class="empty-msg">All stock levels nominal</p>';
  } else {
    lsEl.innerHTML = lowItems.map(p => `
      <div class="alert-card">
        <div>
          <div class="alert-name">${esc(p.name)}</div>
          <div class="text-xs font-mono text-cyber-muted">${esc(p.pid)}</div>
        </div>
        <div class="alert-stock">${p.stock} left</div>
      </div>`).join('');
  }

  const rsEl = document.getElementById('recent-sales-list');
  if (sales.length === 0) {
    rsEl.innerHTML = '<p class="empty-msg">No transactions yet</p>';
  } else {
    rsEl.innerHTML = sales.slice(0,10).map(s => `
      <div class="txn-card">
        <div class="txn-header">
          <span class="txn-id">${esc(s.id)}${s.customer ? ' — '+esc(s.customer) : ''}</span>
          <span class="txn-amount">৳${(s.total||0).toFixed(2)}</span>
        </div>
        <div class="txn-details">
          ${new Date(s.timestamp).toLocaleString()} &middot; 
          ${(s.items||[]).length} item(s) &middot; 
          Profit: ৳${(s.profit||0).toFixed(2)}
        </div>
      </div>`).join('');
  }
  updateOfflineQueueUI();
}

// ── Inventory ─────────────────────────────────────────────────────
function renderInventoryTable(filter = '') {
  const tbody = document.getElementById('inventory-table-body');
  const items = Object.entries(products)
    .filter(([,p]) => !filter ||
      p.name.toLowerCase().includes(filter) ||
      p.pid.toLowerCase().includes(filter));

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-cyber-muted font-mono text-sm">No products found</td></tr>';
    return;
  }

  tbody.innerHTML = items.map(([key, p]) => {
    const isOut  = p.stock <= 0;
    const isLow  = p.stock <= LOW_STOCK_THRESHOLD && !isOut;
    const sc     = isOut ? 'stock-out' : isLow ? 'stock-low' : 'stock-ok';
    const slabel = isOut ? 'OUT' : isLow ? 'LOW' : 'OK';
    return `
    <tr class="table-row">
      <td class="table-td text-cyber-muted text-xs">${esc(p.pid)}</td>
      <td class="table-td text-white">${esc(p.name)}</td>
      <td class="table-td text-right text-cyber-muted">৳${(+p.buyPrice).toFixed(2)}</td>
      <td class="table-td text-right neon-cyan">৳${(+p.sellPrice).toFixed(2)}</td>
      <td class="table-td text-right">
        <span class="stock-pill ${sc}">${p.stock} <span class="opacity-60 text-xs">${slabel}</span></span>
      </td>
      <td class="table-td text-center">
        <div class="flex gap-2 justify-center">
          <button class="action-btn btn-edit" onclick="openProductModal('${key}')">EDIT</button>
          <button class="action-btn btn-delete" onclick="openDeleteModal('${key}')">DEL</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}
window.filterInventory = () =>
  renderInventoryTable(document.getElementById('inv-search').value.toLowerCase());

// ── Product Modal ─────────────────────────────────────────────────
function openProductModal(firebaseKey) {
  firebaseKey = firebaseKey || null;
  document.getElementById('product-firebase-key').value = firebaseKey || '';
  document.getElementById('modal-title').textContent = firebaseKey ? 'EDIT PRODUCT' : 'ADD PRODUCT';
  if (firebaseKey && products[firebaseKey]) {
    const p = products[firebaseKey];
    document.getElementById('form-pid').value        = p.pid;
    document.getElementById('form-name').value       = p.name;
    document.getElementById('form-buy-price').value  = p.buyPrice;
    document.getElementById('form-sell-price').value = p.sellPrice;
    document.getElementById('form-stock').value      = p.stock;
  } else {
    ['form-pid','form-name','form-buy-price','form-sell-price','form-stock']
      .forEach(id => { document.getElementById(id).value = ''; });
  }
  document.getElementById('product-modal').classList.remove('hidden');
}
function closeProductModal() {
  document.getElementById('product-modal').classList.add('hidden');
}
window.openProductModal  = openProductModal;
window.closeProductModal = closeProductModal;

async function saveProduct() {
  const firebaseKey = document.getElementById('product-firebase-key').value || null;
  const pid         = document.getElementById('form-pid').value.trim();
  const name        = document.getElementById('form-name').value.trim();
  const buyPrice    = parseFloat(document.getElementById('form-buy-price').value);
  const sellPrice   = parseFloat(document.getElementById('form-sell-price').value);
  const stock       = parseInt(document.getElementById('form-stock').value, 10);

  if (!pid || !name || isNaN(buyPrice) || isNaN(sellPrice) || isNaN(stock)) {
    showToast('Please fill in all fields correctly', 'error'); return;
  }
  if (stock < 0) { showToast('Stock cannot be negative', 'error'); return; }

  const data = { pid, name, buyPrice, sellPrice, stock, updatedAt: Date.now() };
  try {
    if (firebaseKey) {
      await db.ref('products/' + firebaseKey).update(data);
      showToast('Product updated', 'success');
    } else {
      data.createdAt = Date.now();
      await db.ref('products').push(data);
      showToast('Product added', 'success');
    }
    closeProductModal();
  } catch(e) {
    showToast('Error: ' + e.message, 'error');
  }
}
window.saveProduct = saveProduct;

// ── Delete Modal ──────────────────────────────────────────────────
function openDeleteModal(key) {
  pendingKey = key;
  document.getElementById('delete-modal').classList.remove('hidden');
}
function closeDeleteModal() {
  pendingKey = null;
  document.getElementById('delete-modal').classList.add('hidden');
}
async function confirmDelete() {
  if (!pendingKey) return;
  try {
    await db.ref('products/' + pendingKey).remove();
    showToast('Product deleted', 'success');
  } catch(e) {
    showToast('Delete failed: ' + e.message, 'error');
  }
  closeDeleteModal();
}
window.openDeleteModal  = openDeleteModal;
window.closeDeleteModal = closeDeleteModal;
window.confirmDelete    = confirmDelete;

// Close modals on overlay click
document.getElementById('product-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeProductModal();
});
document.getElementById('delete-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeDeleteModal();
});

// ── POS Grid ──────────────────────────────────────────────────────
function renderPOSGrid(filter) {
  filter = filter || '';
  const grid = document.getElementById('pos-product-grid');
  const items = Object.entries(products)
    .filter(([,p]) => !filter ||
      p.name.toLowerCase().includes(filter) ||
      p.pid.toLowerCase().includes(filter));

  if (items.length === 0) {
    grid.innerHTML = '<p class="empty-msg col-span-3 py-8">No products found</p>';
    return;
  }
  grid.innerHTML = items.map(([key,p]) => {
    const isOut  = p.stock <= 0;
    const isLow  = p.stock <= LOW_STOCK_THRESHOLD && !isOut;
    const sc     = isOut ? 'stock-out' : isLow ? 'stock-low' : 'stock-ok';
    const slabel = isOut ? 'OUT OF STOCK' : isLow ? 'LOW STOCK' : 'IN STOCK';
    return `
    <div class="pos-card ${isOut ? 'out-of-stock' : ''}"
         onclick="${isOut ? '' : "addToCart('" + key + "')"}">
      <span class="stock-badge ${sc}">${slabel}</span>
      <div class="prod-name mt-4">${esc(p.name)}</div>
      <div class="prod-price mt-1">৳${(+p.sellPrice).toFixed(2)}</div>
      <div class="prod-stock mt-1">Stock: ${p.stock} &nbsp;|&nbsp; ${esc(p.pid)}</div>
    </div>`;
  }).join('');
}
window.filterPOSProducts = () =>
  renderPOSGrid(document.getElementById('pos-search').value.toLowerCase());

// ── Cart ──────────────────────────────────────────────────────────
function addToCart(firebaseKey) {
  const p = products[firebaseKey];
  if (!p || p.stock <= 0) return;
  const existing = cart.find(i => i.key === firebaseKey);
  if (existing) {
    if (existing.qty >= p.stock) { showToast('Max stock reached', 'warn'); return; }
    existing.qty++;
  } else {
    cart.push({ key: firebaseKey, qty: 1, name: p.name, sellPrice: +p.sellPrice, buyPrice: +p.buyPrice });
  }
  renderCart();
  showToast(p.name + ' added to cart', 'success');
}
window.addToCart = addToCart;

function changeQty(key, delta) {
  const idx = cart.findIndex(i => i.key === key);
  if (idx === -1) return;
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  renderCart();
}
window.changeQty = changeQty;

function clearCart() {
  cart = [];
  document.getElementById('discount-input').value = 0;
  document.getElementById('customer-name').value  = '';
  renderCart();
}
window.clearCart = clearCart;

function renderCart() {
  const el = document.getElementById('cart-items');
  document.getElementById('cart-count').textContent =
    cart.length + ' item' + (cart.length !== 1 ? 's' : '');
  if (cart.length === 0) {
    el.innerHTML = '<p class="empty-msg py-8">Cart is empty</p>';
    recalcCart(); return;
  }
  el.innerHTML = cart.map(item => `
    <div class="cart-item">
      <button class="cart-qty-btn" onclick="changeQty('${item.key}',-1)" title="Decrease">−</button>
      <span class="cart-qty">${item.qty}</span>
      <button class="cart-qty-btn" onclick="changeQty('${item.key}',1)" title="Increase">+</button>
      <span class="cart-item-name truncate" title="${esc(item.name)}">${esc(item.name)}</span>
      <span class="cart-price">৳${(item.sellPrice * item.qty).toFixed(2)}</span>
      <button class="cart-qty-btn" onclick="changeQty('${item.key}',-999)" title="Remove">✕</button>
    </div>`).join('');
  recalcCart();
}

function recalcCart() {
  const subtotal  = cart.reduce((s,i) => s + i.sellPrice * i.qty, 0);
  const discount  = Math.min(Math.max(parseFloat(document.getElementById('discount-input').value)||0, 0), 100);
  const afterDisc = subtotal * (1 - discount / 100);
  const vat       = afterDisc * VAT_RATE;
  const total     = afterDisc + vat;

  document.getElementById('cart-subtotal').textContent = '৳' + subtotal.toFixed(2);
  document.getElementById('cart-vat').textContent      = '৳' + vat.toFixed(2);
  document.getElementById('cart-total').textContent    = '৳' + total.toFixed(2);
  document.getElementById('checkout-btn').disabled     = cart.length === 0;
}
window.recalcCart = recalcCart;

// ── Checkout ──────────────────────────────────────────────────────
async function checkout() {
  if (cart.length === 0) return;

  const subtotal  = cart.reduce((s,i) => s + i.sellPrice * i.qty, 0);
  const costTotal = cart.reduce((s,i) => s + i.buyPrice  * i.qty, 0);
  const discount  = Math.min(Math.max(parseFloat(document.getElementById('discount-input').value)||0, 0), 100);
  const afterDisc = subtotal * (1 - discount / 100);
  const vat       = afterDisc * VAT_RATE;
  const total     = afterDisc + vat;
  const profit    = afterDisc - costTotal;

  const saleData = {
    id:        'TXN-' + Date.now(),
    customer:  document.getElementById('customer-name').value.trim() || 'Walk-in',
    items:     cart.map(i => ({
      key: i.key, name: i.name,
      qty: i.qty, sellPrice: i.sellPrice, buyPrice: i.buyPrice
    })),
    subtotal, discount, vat, total, profit,
    timestamp: Date.now(),
    synced:    false
  };

  if (isOnline) {
    try {
      await commitSaleToFirebase(saleData);
      showToast('Sale ৳' + total.toFixed(2) + ' completed', 'success');
    } catch(e) {
      addToOfflineQueue(saleData);
      showToast('Saved offline — syncs when online', 'warn');
    }
  } else {
    addToOfflineQueue(saleData);
    showToast('Saved offline — syncs when online', 'warn');
  }
  clearCart();
}
window.checkout = checkout;

async function commitSaleToFirebase(saleData) {
  const updates = {};
  // Deduct stock
  saleData.items.forEach(item => {
    const current = products[item.key];
    if (current) {
      updates['products/' + item.key + '/stock'] =
        Math.max(0, (current.stock || 0) - item.qty);
    }
  });
  // Push sale record
  const newSaleKey = db.ref('sales').push().key;
  updates['sales/' + newSaleKey] = { ...saleData, synced: true };
  await db.ref().update(updates);
}

// ── Helpers ───────────────────────────────────────────────────────
function esc(str) {
  return String(str||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let toastTimer = null;
function showToast(msg, type) {
  type = type || 'info';
  clearTimeout(toastTimer);
  const toast = document.getElementById('toast');
  const icon  = document.getElementById('toast-icon');
  const text  = document.getElementById('toast-message');
  const icons = { success:'✓', error:'✕', warn:'⚠', info:'ℹ' };
  toast.className  = 'toast toast-' + type;
  icon.textContent = icons[type] || 'ℹ';
  text.textContent = msg;
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3200);
}

// ── Service Worker Registration ───────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[SW] Registered:', reg.scope))
      .catch(err => console.warn('[SW] Registration failed:', err));
  });
}

// ── Init ──────────────────────────────────────────────────────────
recalcCart();
updateOfflineQueueUI();
