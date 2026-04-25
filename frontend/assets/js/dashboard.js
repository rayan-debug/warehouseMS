(() => {
  const state = {
    user: null,
    categories: [],
    products: [],
    inventory: [],
    alerts: [],
    sales: [],
    users: [],
    cart: [],
    activePage: 'dashboard',
    alertFilter: '',
    lowStockOnly: false,
    productSearch: '',
    productCategoryFilter: '',
    saleSearch: '',
    activityPage: 1,
    activityUserFilter: '',
  };

  const $ = (id) => document.getElementById(id);
  const byPage = (page) => document.getElementById(`page-${page}`);

  function getLocalUser() {
    try {
      return JSON.parse(localStorage.getItem('wms_user') || 'null');
    } catch {
      return null;
    }
  }

  function requireAuth() {
    if (!getToken()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }

  function setUser(user) {
    state.user = user;
    $('userName').textContent = user?.name || 'Guest';
    $('userRole').textContent = user?.role || '—';
    $('userAvatar').textContent = (user?.name || '?').slice(0, 1).toUpperCase();
    const adminNav = $('adminNav');
    if (adminNav) {
      adminNav.style.display = user?.role === 'admin' ? 'block' : 'none';
    }
    document.querySelectorAll('.admin-only').forEach((el) => {
      el.style.display = user?.role === 'admin' ? '' : 'none';
    });
  }

  function navigate(page) {
    state.activePage = page;
    document.querySelectorAll('.page-view').forEach((view) => view.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.page === page));
    const target = byPage(page);
    if (target) target.classList.add('active');
    const titles = {
      dashboard: 'Dashboard',
      products: 'Products',
      inventory: 'Inventory',
      alerts: 'Alerts',
      sales: 'Sales',
      'new-sale': 'New Sale',
      users: 'Users',
      reports: 'Reports',
      activity: 'Activity Log',
    };
    $('pageTitle').textContent = titles[page] || 'WarehouseMS';
    if (page === 'activity') loadActivity(1);
  }

  async function loadBootData() {
    const [me, categories] = await Promise.all([
      apiRequest('/auth/me'),
      apiRequest('/categories'),
    ]);
    setUser(me.user);
    state.categories = categories.categories || [];
    populateCategoryFilters();
    populateProductCategorySelect();
    if (me.user?.role === 'admin') loadActivityUsers();
  }

  function populateCategoryFilters() {
    const filters = [$('categoryFilter'), $('pm_category')];
    filters.forEach((select) => {
      if (!select) return;
      const current = select.value;
      select.innerHTML = select.id === 'pm_category' ? '<option value="">Select category</option>' : '<option value="">All categories</option>';
      state.categories.forEach((category) => {
        const option = document.createElement('option');
        option.value = String(category.id);
        option.textContent = category.name;
        if (current && current === String(category.id)) {
          option.selected = true;
        }
        select.appendChild(option);
      });
    });
  }

  function populateProductCategorySelect() {
    const select = $('pm_category');
    if (!select) return;
    select.innerHTML = '<option value="">Select category</option>';
    state.categories.forEach((category) => {
      const option = document.createElement('option');
      option.value = category.id;
      option.textContent = category.name;
      select.appendChild(option);
    });
  }

  async function refreshAll() {
    await loadProducts();
    await Promise.all([
      loadDashboard(),
      loadInventory(),
      loadAlerts(),
      loadSales(),
      loadUsers(),
      loadSaleProducts(),
    ]);
  }

  async function loadDashboard() {
    const data = await apiRequest('/admin/dashboard');
    const stats = data.stats || {};
    $('statsGrid').innerHTML = [
      ['Total Products', stats.totalProducts ?? 0],
      ['Low Stock', stats.lowStock ?? 0],
      ['Today\'s Revenue', formatCurrency(stats.todayRevenue ?? 0)],
      ['Monthly Revenue', formatCurrency(stats.monthRevenue ?? 0)],
    ].map(([label, value]) => `
      <div class="stat-card">
        <div class="stat-label">${label}</div>
        <div class="stat-value">${value}</div>
      </div>
    `).join('');

    const topProds = stats.topMovingProducts || [];
    const maxSold = topProds.reduce((m, p) => Math.max(m, p.total_sold || 0), 1);
    $('topProductsList').innerHTML = topProds.length
      ? topProds.map((item) => `
          <div class="bar-row">
            <span class="bar-label" title="${item.name}">${item.name}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.round(((item.total_sold||0)/maxSold)*100)}%"></div></div>
            <span class="bar-count">${item.total_sold || 0}</span>
          </div>`).join('')
      : '<div class="alert-meta" style="padding:8px 0">No product movement yet.</div>';

    $('recentAlertsList').innerHTML = (stats.recentAlerts || []).length
      ? stats.recentAlerts.map(renderAlertPreview).join('')
      : '<div class="alert-meta">No recent alerts.</div>';

    const badge = $('alertBadge');
    const unread = state.alerts.filter((alert) => !alert.is_read).length;
    if (badge) {
      badge.textContent = String(unread);
      badge.style.display = unread ? 'inline-grid' : 'none';
    }
  }

  async function loadProducts() {
    const data = await apiRequest('/products');
    state.products = data.products || [];
    renderProducts();
  }

  function renderProducts() {
    const isAdmin = state.user?.role === 'admin';
    const rows = state.products
      .filter((product) => !state.productSearch || product.name.toLowerCase().includes(state.productSearch.toLowerCase()))
      .filter((product) => !state.productCategoryFilter || String(product.category_id) === state.productCategoryFilter)
      .filter((product) => !state.lowStockOnly || Number(product.quantity || 0) <= Number(product.threshold || 0))
      .map((product, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>
            <div style="font-weight:600">${product.name}</div>
            <div class="alert-meta">${product.description || ''}</div>
          </td>
          <td>${product.category_name || '—'}</td>
          <td>${Number(product.quantity || 0)}</td>
          <td>${Number(product.threshold || 0)}</td>
          <td>${formatDate(product.expiry_date)}</td>
          <td><span class="badge badge-${product.status || 'ok'}">${(product.status || 'ok').toUpperCase()}</span></td>
          <td>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-ghost btn-sm" data-edit-product="${product.id}">Edit</button>
              <button class="btn btn-ghost btn-sm" data-stock-product="${product.id}">Stock</button>
              ${isAdmin ? `<button class="btn btn-danger btn-sm" data-delete-product="${product.id}">Delete</button>` : ''}
            </div>
          </td>
        </tr>
      `).join('');
    $('productsTableBody').innerHTML = rows || '<tr><td colspan="8">No products found.</td></tr>';
    $('productsTableBody').querySelectorAll('[data-edit-product]').forEach((button) => button.addEventListener('click', () => openProductModal(button.dataset.editProduct)));
    $('productsTableBody').querySelectorAll('[data-stock-product]').forEach((button) => button.addEventListener('click', () => openStockModal(button.dataset.stockProduct)));
    $('productsTableBody').querySelectorAll('[data-delete-product]').forEach((button) => button.addEventListener('click', () => removeProduct(button.dataset.deleteProduct)));
  }

  async function loadInventory() {
    const data = await apiRequest('/inventory');
    state.inventory = data.inventory || [];
    const isAdmin = state.user?.role === 'admin';
    $('inventoryTableBody').innerHTML = state.inventory.map((item) => `
      <tr>
        <td>${item.product_name}</td>
        <td>${item.category_name || '—'}</td>
        <td>${item.quantity}</td>
        <td>${item.threshold}</td>
        <td>${formatDate(item.expiry_date)}</td>
        <td>${formatDateTime(item.last_updated)}</td>
        <td><span class="badge badge-${item.status}">${item.status.toUpperCase()}</span></td>
        <td>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" data-stock-id="${item.id}">Add stock</button>
            ${isAdmin ? `<button class="btn btn-ghost btn-sm" data-adjust-id="${item.id}" data-adjust-name="${item.product_name}">Correct</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="8">No inventory data found.</td></tr>';
    $('inventoryTableBody').querySelectorAll('[data-stock-id]').forEach((button) => button.addEventListener('click', () => openStockModal(button.dataset.stockId)));
    $('inventoryTableBody').querySelectorAll('[data-adjust-id]').forEach((button) => button.addEventListener('click', () => openAdjustModal(button.dataset.adjustId, button.dataset.adjustName)));
  }

  async function loadAlerts() {
    const data = await apiRequest('/alerts');
    state.alerts = data.alerts || [];
    $('alertsList').innerHTML = state.alerts.map(renderAlertCard).join('') || '<div class="card">No alerts right now.</div>';
    $('alertBadge').textContent = String(state.alerts.filter((alert) => !alert.is_read).length);
    $('alertBadge').style.display = state.alerts.some((alert) => !alert.is_read) ? 'inline-grid' : 'none';
  }

  function renderAlertPreview(alert) {
    return `<div class="sale-row"><div class="alert-title">${alert.type.toUpperCase()} Alert</div><div class="alert-meta">${alert.message}</div></div>`;
  }

  function renderAlertCard(alert) {
    return `
      <div class="alert-item ${alert.is_read ? '' : 'unread'}">
        <div class="alert-title">${alert.type.toUpperCase()} — ${alert.inventory_name}</div>
        <div class="alert-meta">${alert.message}</div>
        <div class="alert-meta" style="margin-top:6px">${formatDateTime(alert.created_at)}</div>
        <div style="margin-top:10px">
          ${alert.is_read ? '<span class="badge badge-ok">Read</span>' : `<button class="btn btn-ghost btn-sm" data-read-alert="${alert.id}">Mark read</button>`}
        </div>
      </div>
    `;
  }

  async function loadSales() {
    const data = await apiRequest('/sales');
    state.sales = data.sales || [];
    $('salesTableBody').innerHTML = state.sales.map((sale) => `
      <tr>
        <td>#${sale.id}</td>
        <td>${sale.user_name}</td>
        <td>${sale.items}</td>
        <td>${formatCurrency(sale.total_amount)}</td>
        <td>${formatDateTime(sale.created_at)}</td>
        <td><button class="btn btn-ghost btn-sm" data-invoice-id="${sale.id}">Invoice</button></td>
      </tr>
    `).join('') || '<tr><td colspan="6">No sales yet.</td></tr>';
    $('salesTableBody').querySelectorAll('[data-invoice-id]').forEach((button) => button.addEventListener('click', () => downloadInvoice(button.dataset.invoiceId)));
  }

  async function loadUsers() {
    if (state.user?.role !== 'admin') {
      $('usersTableBody').innerHTML = '<tr><td colspan="6">Admin access required.</td></tr>';
      return;
    }
    const data = await apiRequest('/admin/users');
    state.users = data.users || [];
    $('usersTableBody').innerHTML = state.users.map((user, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${user.name}</td>
        <td>${user.email}</td>
        <td><span class="badge badge-${user.role === 'admin' ? 'warn' : 'ok'}">${user.role.toUpperCase()}</span></td>
        <td>${formatDateTime(user.created_at)}</td>
        <td>${user.id === state.user.id ? '<span class="badge badge-info">You</span>' : `<button class="btn btn-danger btn-sm" data-delete-user="${user.id}">Delete</button>`}</td>
      </tr>
    `).join('') || '<tr><td colspan="6">No users found.</td></tr>';
    $('usersTableBody').querySelectorAll('[data-delete-user]').forEach((button) => button.addEventListener('click', () => removeUser(button.dataset.deleteUser)));
  }

  async function loadSaleProducts() {
    const rows = state.products
      .filter((product) => !state.saleSearch || product.name.toLowerCase().includes(state.saleSearch.toLowerCase()))
      .map((product) => `
        <tr>
          <td>${product.name}</td>
          <td>${product.quantity}</td>
          <td>${formatCurrency(product.price || 0)}</td>
          <td><button class="btn btn-primary btn-sm" data-add-to-sale="${product.id}">Add</button></td>
        </tr>
      `)
      .join('');
    $('saleProductsBody').innerHTML = rows || '<tr><td colspan="4">No sale products available.</td></tr>';
    $('saleProductsBody').querySelectorAll('[data-add-to-sale]').forEach((button) => button.addEventListener('click', () => openAddToCartModal(button.dataset.addToSale)));
    renderCart();
  }

  function renderCart() {
    if (!state.cart.length) {
      $('cartItems').innerHTML = '<p style="color:var(--text-muted);font-size:0.83rem;text-align:center;padding:20px 0">No items added yet</p>';
      $('cartTotal').textContent = formatCurrency(0);
      return;
    }

    $('cartItems').innerHTML = state.cart.map((item, index) => `
      <div class="sale-row" style="display:flex;justify-content:space-between;gap:12px;align-items:center">
        <div>
          <div style="font-weight:600">${item.name}</div>
          <div class="alert-meta">${item.quantity} × ${formatCurrency(item.price)}</div>
        </div>
        <button class="btn btn-danger btn-sm" data-remove-cart="${index}">Remove</button>
      </div>
    `).join('');
    $('cartItems').querySelectorAll('[data-remove-cart]').forEach((button) => button.addEventListener('click', () => {
      state.cart.splice(Number(button.dataset.removeCart), 1);
      renderCart();
    }));
    const total = state.cart.reduce((sum, item) => sum + item.quantity * item.price, 0);
    $('cartTotal').textContent = formatCurrency(total);
  }

  function openProductModal(id = '') {
    const product = state.products.find((entry) => String(entry.id) === String(id));
    $('productModalTitle').textContent = product ? 'Edit Product' : 'Add Product';
    $('saveProductBtn').dataset.productId = product ? product.id : '';
    $('pm_name').value = product?.name || '';
    $('pm_description').value = product?.description || '';
    $('pm_price').value = product?.price ?? 0;
    $('pm_quantity').value = product?.quantity ?? 0;
    $('pm_threshold').value = product?.threshold ?? 10;
    $('pm_expiry').value = product?.expiry_date ? product.expiry_date.slice(0, 10) : '';
    $('pm_category').value = product?.category_id || '';
    modal.open('productModal');
  }

  function openStockModal(id) {
    const product = state.products.find((entry) => String(entry.id) === String(id)) || state.inventory.find((entry) => String(entry.id) === String(id));
    const inventoryRecord = state.inventory.find((entry) => String(entry.id) === String(id)) || state.inventory.find((entry) => String(entry.product_id) === String(id));
    $('stockProductId').value = inventoryRecord?.id || '';
    $('stockQty').value = 1;
    $('stockExpiry').value = '';
    $('stockProductName').textContent = product?.product_name || product?.name || 'Selected product';
    modal.open('stockModal');
  }

  function openAddToCartModal(productId) {
    const product = state.products.find((entry) => String(entry.id) === String(productId));
    if (!product) return;
    $('atcProductId').value = product.id;
    $('atcMaxQty').value = product.quantity;
    $('atcProductName').textContent = product.name;
    $('atcAvailable').textContent = `${product.quantity} units available`;
    $('atcQty').value = 1;
    $('atcPrice').value = product.price || 0;
    $('atcPriceDisplay').textContent = formatCurrency(product.price || 0);
    modal.open('addToCartModal');
  }

  async function saveProduct() {
    const productId = $('saveProductBtn').dataset.productId;
    const payload = {
      name: $('pm_name').value.trim(),
      description: $('pm_description').value.trim(),
      category_id: $('pm_category').value ? Number($('pm_category').value) : null,
      price: Number($('pm_price').value || 0),
      quantity: Number($('pm_quantity').value || 0),
      threshold: Number($('pm_threshold').value || 10),
      expiry_date: $('pm_expiry').value || null,
    };
    if (!payload.name) {
      toast('Product name is required.', 'error');
      return;
    }
    await apiRequest(productId ? `/products/${productId}` : '/products', {
      method: productId ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    modal.close('productModal');
    toast(`Product ${productId ? 'updated' : 'created'}.`);
    await refreshAll();
  }

  async function saveStock() {
    const id = $('stockProductId').value;
    await apiRequest(`/inventory/${id}/stock`, {
      method: 'POST',
      body: JSON.stringify({ quantity: Number($('stockQty').value || 0), expiry_date: $('stockExpiry').value || null }),
    });
    modal.close('stockModal');
    toast('Stock added.');
    await refreshAll();
  }

  function openAdjustModal(inventoryId, productName) {
    $('adjustInventoryId').value = inventoryId;
    $('adjustProductName').textContent = productName || 'Selected product';
    $('adjustQty').value = '0';
    $('adjustReason').value = '';
    modal.open('adjustModal');
  }

  async function saveAdjust() {
    const id = $('adjustInventoryId').value;
    const adjustment = Number($('adjustQty').value);
    const reason = $('adjustReason').value.trim();
    if (!adjustment) { toast('Adjustment cannot be zero.', 'error'); return; }
    if (!reason) { toast('Reason is required.', 'error'); return; }
    await apiRequest(`/inventory/${id}/adjust`, {
      method: 'POST',
      body: JSON.stringify({ adjustment, reason }),
    });
    modal.close('adjustModal');
    toast('Stock corrected.');
    await refreshAll();
  }

  async function saveUser() {
    await apiRequest('/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        name: $('um_name').value.trim(),
        email: $('um_email').value.trim(),
        password: $('um_password').value,
        role: $('um_role').value,
      }),
    });
    modal.close('userModal');
    toast('User created.');
    await loadUsers();
  }

  async function addToCart() {
    const productId = Number($('atcProductId').value);
    const quantity = Number($('atcQty').value || 1);
    const product = state.products.find((entry) => entry.id === productId);
    const maxQty = Number($('atcMaxQty').value || 0);
    if (!product || !Number.isInteger(quantity) || quantity <= 0 || quantity > maxQty) {
      toast('Invalid quantity.', 'error');
      return;
    }
    const existing = state.cart.find((item) => item.product_id === productId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      state.cart.push({ product_id: productId, name: product.name, quantity, price: Number(product.price || 0) });
    }
    modal.close('addToCartModal');
    renderCart();
  }

  async function processSale() {
    if (!state.cart.length) {
      toast('Add at least one item first.', 'error');
      return;
    }
    await apiRequest('/sales', {
      method: 'POST',
      body: JSON.stringify({
        items: state.cart.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
        notes: $('saleNotes').value.trim(),
      }),
    });
    state.cart = [];
    $('saleNotes').value = '';
    toast('Sale completed.');
    await refreshAll();
  }

  async function downloadInvoice(id) {
    const response = await fetch(`${API_BASE}/sales/${id}/invoice`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!response.ok) {
      toast('Could not download invoice.', 'error');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `invoice-${id}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function downloadSalesReport() {
    const response = await fetch(`${API_BASE}/admin/reports/sales`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!response.ok) {
      toast('Could not download report.', 'error');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'monthly-sales-report.pdf';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function removeProduct(id) {
    if (!confirm('Delete this product?')) return;
    await apiRequest(`/products/${id}`, { method: 'DELETE' });
    toast('Product deleted.');
    await refreshAll();
  }

  async function removeUser(id) {
    if (!confirm('Delete this user?')) return;
    await apiRequest(`/admin/users/${id}`, { method: 'DELETE' });
    toast('User deleted.');
    await loadUsers();
  }

  async function markAlertRead(id) {
    await apiRequest(`/alerts/${id}/read`, { method: 'PATCH' });
    await loadAlerts();
    await loadDashboard();
  }

  async function markAllAlertsRead() {
    await apiRequest('/alerts/read-all', { method: 'PATCH' });
    await refreshAll();
  }

  async function loadActivityUsers() {
    if (state.user?.role !== 'admin') return;
    const data = await apiRequest('/activity/users');
    const select = $('activityUserFilter');
    if (!select) return;
    select.style.display = '';
    select.innerHTML = '<option value="">All staff</option>';
    (data.users || []).forEach((u) => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = `${u.name} (${u.role})`;
      select.appendChild(opt);
    });
  }

  async function loadActivity(page = state.activityPage) {
    state.activityPage = page;
    const params = new URLSearchParams({ page, limit: 50 });
    if (state.user?.role === 'admin' && state.activityUserFilter) {
      params.set('user_id', state.activityUserFilter);
    }
    const data = await apiRequest(`/activity?${params}`);
    renderActivity(data.logs || [], data.pagination || {});
  }

  function renderActivity(logs, pagination) {
    const isAdmin = state.user?.role === 'admin';
    $('activityUserCol').style.display = isAdmin ? '' : 'none';

    if (!logs.length) {
      $('activityTableBody').innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:32px">No activity yet.</td></tr>';
      $('activityPagination').innerHTML = '';
      return;
    }

    $('activityTableBody').innerHTML = logs.map((log) => `
      <tr>
        <td style="white-space:nowrap;color:var(--text-muted);font-size:0.8rem">${formatDateTime(log.created_at)}</td>
        <td ${isAdmin ? '' : 'style="display:none"'}>
          <div style="font-weight:600;font-size:0.85rem">${log.user_name}</div>
          <span class="badge badge-${log.user_role === 'admin' ? 'warn' : 'ok'}" style="font-size:0.7rem">${log.user_role.toUpperCase()}</span>
        </td>
        <td style="font-weight:500">${log.action}</td>
        <td style="color:var(--text-secondary);font-size:0.85rem">${log.details || '—'}</td>
      </tr>
    `).join('');

    const { page, pages } = pagination;
    if (pages > 1) {
      const btns = [];
      if (page > 1) btns.push(`<button class="btn btn-ghost btn-sm" data-act-page="${page - 1}">← Prev</button>`);
      btns.push(`<span style="color:var(--text-muted);font-size:0.8rem;line-height:30px">Page ${page} / ${pages}</span>`);
      if (page < pages) btns.push(`<button class="btn btn-ghost btn-sm" data-act-page="${page + 1}">Next →</button>`);
      $('activityPagination').innerHTML = btns.join('');
      $('activityPagination').querySelectorAll('[data-act-page]').forEach((btn) =>
        btn.addEventListener('click', () => loadActivity(Number(btn.dataset.actPage)))
      );
    } else {
      $('activityPagination').innerHTML = '';
    }
  }

  async function logout() {
    clearSession();
    window.location.href = 'login.html';
  }

  function attachEvents() {
    document.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', () => navigate(item.dataset.page)));
    $('refreshBtn').addEventListener('click', refreshAll);
    $('logoutBtn')?.addEventListener('click', logout);
    $('viewAllAlertsBtn')?.addEventListener('click', (e) => { e.preventDefault(); navigate('alerts'); });
    $('refreshActivityBtn')?.addEventListener('click', () => loadActivity(1));
    $('activityUserFilter')?.addEventListener('change', (e) => { state.activityUserFilter = e.target.value; loadActivity(1); });
    $('addProductBtn')?.addEventListener('click', () => openProductModal());
    $('saveProductBtn')?.addEventListener('click', saveProduct);
    $('confirmAddStockBtn')?.addEventListener('click', saveStock);
    $('saveAdjustBtn')?.addEventListener('click', saveAdjust);
    $('addUserBtn')?.addEventListener('click', () => modal.open('userModal'));
    $('saveUserBtn')?.addEventListener('click', saveUser);
    $('processSaleBtn')?.addEventListener('click', processSale);
    $('clearCartBtn')?.addEventListener('click', () => { state.cart = []; renderCart(); });
    $('downloadSalesReportBtn')?.addEventListener('click', downloadSalesReport);
    $('filterAllAlerts')?.addEventListener('click', () => { state.alertFilter = ''; renderAlertsOnly(); });
    $('filterLowAlerts')?.addEventListener('click', () => { state.alertFilter = 'low'; renderAlertsOnly(); });
    $('filterExpiryAlerts')?.addEventListener('click', () => { state.alertFilter = 'expiry'; renderAlertsOnly(); });
    $('markAllReadBtn')?.addEventListener('click', markAllAlertsRead);
    $('lowStockFilter')?.addEventListener('click', () => { state.lowStockOnly = !state.lowStockOnly; renderProducts(); });
    $('productSearch')?.addEventListener('input', (e) => { state.productSearch = e.target.value; renderProducts(); });
    $('categoryFilter')?.addEventListener('change', (e) => { state.productCategoryFilter = e.target.value; renderProducts(); });
    $('saleProductSearch')?.addEventListener('input', (e) => { state.saleSearch = e.target.value; loadSaleProducts(); });
    $('confirmAddToCartBtn')?.addEventListener('click', addToCart);

    ['productModal', 'stockModal', 'userModal', 'addToCartModal', 'adjustModal'].forEach((id) => {
      const backdrop = $(id);
      backdrop?.addEventListener('click', (event) => {
        if (event.target === backdrop) modal.close(id);
      });
    });

    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => modal.close(btn.dataset.closeModal));
    });

    document.addEventListener('click', (event) => {
      const readTarget = event.target.closest?.('[data-read-alert]');
      if (readTarget) markAlertRead(readTarget.dataset.readAlert);
    });
  }

  function renderAlertsOnly() {
    const filtered = state.alertFilter ? state.alerts.filter((alert) => alert.type === state.alertFilter) : state.alerts;
    $('alertsList').innerHTML = filtered.map(renderAlertCard).join('') || '<div class="card">No alerts right now.</div>';
    document.querySelectorAll('[data-read-alert]').forEach((button) => button.addEventListener('click', () => markAlertRead(button.dataset.readAlert)));
  }

  async function init() {
    if (!requireAuth()) {
      return;
    }
    setUser(getLocalUser());
    attachEvents();
    navigate('dashboard');
    try {
      await loadBootData();
      await refreshAll();
    } catch (error) {
      console.error(error);
      toast(error.message || 'Failed to load application data.', 'error');
    }
  }

  window.navigate = navigate;
  window.logout = logout;
  document.addEventListener('DOMContentLoaded', init);
})();
