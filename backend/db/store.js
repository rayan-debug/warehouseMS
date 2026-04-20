const bcrypt = require('bcryptjs');

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

const categories = [
  { id: 1, name: 'Dairy' },
  { id: 2, name: 'Bakery' },
  { id: 3, name: 'Produce' },
  { id: 4, name: 'Beverages' },
];

const users = [
  {
    id: 1,
    name: 'Admin User',
    email: 'admin@warehouse.com',
    password: bcrypt.hashSync('Admin@1234', 10),
    role: 'admin',
    google_id: null,
    created_at: now(),
  },
  {
    id: 2,
    name: 'Staff User',
    email: 'staff@warehouse.com',
    password: bcrypt.hashSync('Staff@1234', 10),
    role: 'staff',
    google_id: null,
    created_at: now(),
  },
];

const products = [
  { id: 1, name: 'Full Fat Milk 1L', description: 'Fresh whole milk', category_id: 1, price: 2.99, created_at: now() },
  { id: 2, name: 'White Bread Loaf', description: 'Soft sliced loaf', category_id: 2, price: 1.79, created_at: now() },
  { id: 3, name: 'Bananas', description: 'Fresh ripe bananas', category_id: 3, price: 0.69, created_at: now() },
  { id: 4, name: 'Orange Juice 1L', description: 'No added sugar', category_id: 4, price: 3.49, created_at: now() },
];

const inventory = [
  { id: 1, product_id: 1, quantity: 42, expiry_date: addDays(12), threshold: 10, last_updated: now() },
  { id: 2, product_id: 2, quantity: 8, expiry_date: addDays(5), threshold: 12, last_updated: now() },
  { id: 3, product_id: 3, quantity: 24, expiry_date: addDays(4), threshold: 15, last_updated: now() },
  { id: 4, product_id: 4, quantity: 15, expiry_date: addDays(28), threshold: 8, last_updated: now() },
];

const alerts = [
  { id: 1, inventory_id: 2, type: 'low', message: 'White Bread Loaf is running low.', is_read: false, created_at: now() },
  { id: 2, inventory_id: 3, type: 'expiry', message: 'Bananas expire soon.', is_read: false, created_at: now() },
];

const sales = [
  { id: 1, user_id: 2, total_amount: 8.97, notes: 'Demo sale', created_at: now() },
];

const saleItems = [
  { id: 1, sale_id: 1, product_id: 1, quantity: 2, price_at_sale: 2.99 },
  { id: 2, sale_id: 1, product_id: 2, quantity: 1, price_at_sale: 2.99 },
];

let nextUserId = users.length + 1;
let nextCategoryId = categories.length + 1;
let nextProductId = products.length + 1;
let nextInventoryId = inventory.length + 1;
let nextAlertId = alerts.length + 1;
let nextSaleId = sales.length + 1;
let nextSaleItemId = saleItems.length + 1;

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getCategoryName(categoryId) {
  return categories.find((category) => category.id === categoryId)?.name || null;
}

function getInventoryRecord(productId) {
  return inventory.find((entry) => entry.product_id === productId);
}

function getProductInventory(productId) {
  const product = products.find((entry) => entry.id === productId);
  const stock = getInventoryRecord(productId);
  if (!product || !stock) {
    return null;
  }
  return {
    ...clone(product),
    category_name: getCategoryName(product.category_id),
    quantity: stock.quantity,
    threshold: stock.threshold,
    expiry_date: stock.expiry_date,
    last_updated: stock.last_updated,
    status: getStockStatus(stock.quantity, stock.threshold),
  };
}

function getStockStatus(quantity, threshold) {
  if (quantity <= 0) {
    return 'out';
  }
  if (quantity <= threshold) {
    return 'low';
  }
  return 'ok';
}

function ensureAlert(inventoryId, type, message) {
  const existing = alerts.find((alert) => alert.inventory_id === inventoryId && alert.type === type && !alert.is_read);
  if (existing) {
    existing.message = message;
    existing.created_at = now();
    return existing;
  }

  const alert = {
    id: nextAlertId++,
    inventory_id: inventoryId,
    type,
    message,
    is_read: false,
    created_at: now(),
  };
  alerts.unshift(alert);
  return alert;
}

function refreshAlertsForInventory(record) {
  const product = products.find((entry) => entry.id === record.product_id);
  if (!product) {
    return;
  }
  if (record.quantity <= record.threshold) {
    ensureAlert(record.id, 'low', `${product.name} is running low.`);
  }
  if (record.expiry_date) {
    const expiry = new Date(record.expiry_date);
    const daysRemaining = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
    if (daysRemaining <= 30) {
      ensureAlert(record.id, 'expiry', `${product.name} expires in ${Math.max(daysRemaining, 0)} day(s).`);
    }
  }
}

function seedExpiryAlerts() {
  inventory.forEach((record) => refreshAlertsForInventory(record));
}

function authenticateUser(email, password) {
  const user = users.find((entry) => entry.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return null;
  }
  const valid = bcrypt.compareSync(password, user.password || '');
  return valid ? clone(user) : null;
}

function upsertGoogleUser({ email, name, googleId }) {
  const existing = users.find((entry) => entry.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    existing.google_id = googleId || existing.google_id;
    existing.name = name || existing.name;
    return clone(existing);
  }

  const user = {
    id: nextUserId++,
    name: name || email.split('@')[0],
    email,
    password: null,
    role: 'staff',
    google_id: googleId || null,
    created_at: now(),
  };
  users.push(user);
  return clone(user);
}

function listProducts() {
  return products.map((product) => {
    const stock = getInventoryRecord(product.id) || {};
    return {
      ...clone(product),
      category_name: getCategoryName(product.category_id),
      quantity: stock.quantity ?? 0,
      threshold: stock.threshold ?? 10,
      expiry_date: stock.expiry_date ?? null,
      last_updated: stock.last_updated ?? null,
      status: getStockStatus(stock.quantity ?? 0, stock.threshold ?? 10),
    };
  });
}

function createProduct(input) {
  const product = {
    id: nextProductId++,
    name: input.name,
    description: input.description || '',
    category_id: input.category_id || null,
    price: Number(input.price ?? 0),
    created_at: now(),
  };
  products.push(product);

  const stock = {
    id: nextInventoryId++,
    product_id: product.id,
    quantity: Number(input.quantity ?? 0),
    expiry_date: input.expiry_date || null,
    threshold: Number(input.threshold ?? 10),
    last_updated: now(),
  };
  inventory.push(stock);
  refreshAlertsForInventory(stock);

  return getProductInventory(product.id);
}

function updateProduct(id, input) {
  const product = products.find((entry) => entry.id === Number(id));
  if (!product) {
    return null;
  }

  if (input.name !== undefined) product.name = input.name;
  if (input.description !== undefined) product.description = input.description;
  if (input.category_id !== undefined) product.category_id = input.category_id || null;
  if (input.price !== undefined) product.price = Number(input.price);

  const stock = getInventoryRecord(product.id);
  if (stock) {
    if (input.quantity !== undefined) stock.quantity = Number(input.quantity);
    if (input.threshold !== undefined) stock.threshold = Number(input.threshold);
    if (input.expiry_date !== undefined) stock.expiry_date = input.expiry_date || null;
    stock.last_updated = now();
    refreshAlertsForInventory(stock);
  }

  return getProductInventory(product.id);
}

function deleteProduct(id) {
  const productId = Number(id);
  const productIndex = products.findIndex((entry) => entry.id === productId);
  if (productIndex === -1) {
    return false;
  }

  const inventoryIndex = inventory.findIndex((entry) => entry.product_id === productId);
  if (inventoryIndex !== -1) {
    const record = inventory[inventoryIndex];
    alerts.filter((alert) => alert.inventory_id === record.id).forEach((alert) => {
      const alertIndex = alerts.findIndex((entry) => entry.id === alert.id);
      if (alertIndex !== -1) {
        alerts.splice(alertIndex, 1);
      }
    });
    inventory.splice(inventoryIndex, 1);
  }

  products.splice(productIndex, 1);
  return true;
}

function listInventory() {
  return inventory.map((record) => {
    const product = products.find((entry) => entry.id === record.product_id);
    return {
      id: record.id,
      product_id: record.product_id,
      product_name: product?.name || 'Unknown product',
      category_name: getCategoryName(product?.category_id) || null,
      quantity: record.quantity,
      threshold: record.threshold,
      expiry_date: record.expiry_date,
      last_updated: record.last_updated,
      status: getStockStatus(record.quantity, record.threshold),
    };
  });
}

function addStock(recordId, quantity, expiryDate) {
  const record = inventory.find((entry) => entry.id === Number(recordId));
  if (!record) {
    return null;
  }
  record.quantity += Number(quantity);
  if (expiryDate) {
    record.expiry_date = expiryDate;
  }
  record.last_updated = now();
  refreshAlertsForInventory(record);
  return record;
}

function overrideQuantity(recordId, quantity) {
  const record = inventory.find((entry) => entry.id === Number(recordId));
  if (!record) {
    return null;
  }
  record.quantity = Number(quantity);
  record.last_updated = now();
  refreshAlertsForInventory(record);
  return record;
}

function listSales() {
  return sales
    .slice()
    .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
    .map((sale) => ({
      ...clone(sale),
      user_name: users.find((user) => user.id === sale.user_id)?.name || 'Unknown',
      items: saleItems.filter((item) => item.sale_id === sale.id).length,
    }));
}

function processSale({ userId, items, notes }) {
  const cleanItems = items
    .map((item) => ({
      product_id: Number(item.product_id),
      quantity: Number(item.quantity),
      price_at_sale: Number(item.price_at_sale),
    }))
    .filter((item) => item.product_id && item.quantity > 0 && item.price_at_sale >= 0);

  if (!cleanItems.length) {
    throw new Error('Sale must contain at least one valid item.');
  }

  const preview = cleanItems.map((item) => {
    const product = products.find((entry) => entry.id === item.product_id);
    const stock = getInventoryRecord(item.product_id);
    if (!product || !stock) {
      throw new Error('One or more products are missing from inventory.');
    }
    if (stock.quantity < item.quantity) {
      throw new Error(`Insufficient stock for ${product.name}.`);
    }
    return { product, stock, ...item };
  });

  const totalAmount = preview.reduce((sum, item) => sum + item.quantity * item.price_at_sale, 0);
  const sale = {
    id: nextSaleId++,
    user_id: Number(userId),
    total_amount: Number(totalAmount.toFixed(2)),
    notes: notes || '',
    created_at: now(),
  };
  sales.unshift(sale);

  preview.forEach((item) => {
    item.stock.quantity -= item.quantity;
    item.stock.last_updated = now();
    saleItems.push({
      id: nextSaleItemId++,
      sale_id: sale.id,
      product_id: item.product.id,
      quantity: item.quantity,
      price_at_sale: item.price_at_sale,
    });
    refreshAlertsForInventory(item.stock);
  });

  return getSaleDetail(sale.id);
}

function getSaleDetail(saleId) {
  const sale = sales.find((entry) => entry.id === Number(saleId));
  if (!sale) {
    return null;
  }
  return {
    ...clone(sale),
    user_name: users.find((user) => user.id === sale.user_id)?.name || 'Unknown',
    items: saleItems
      .filter((item) => item.sale_id === sale.id)
      .map((item) => ({
        ...clone(item),
        product_name: products.find((product) => product.id === item.product_id)?.name || 'Unknown product',
      })),
  };
}

function listAlerts(type) {
  return alerts
    .filter((alert) => !type || alert.type === type)
    .map((alert) => {
      const inventoryRecord = inventory.find((record) => record.id === alert.inventory_id);
      const product = inventoryRecord ? products.find((entry) => entry.id === inventoryRecord.product_id) : null;
      return {
        ...clone(alert),
        inventory_name: product?.name || 'Unknown product',
      };
    })
    .sort((left, right) => new Date(right.created_at) - new Date(left.created_at));
}

function markAlertRead(alertId) {
  const alert = alerts.find((entry) => entry.id === Number(alertId));
  if (!alert) {
    return null;
  }
  alert.is_read = true;
  return alert;
}

function markAllAlertsRead() {
  alerts.forEach((alert) => {
    alert.is_read = true;
  });
  return true;
}

function getDashboardStats() {
  const totalProducts = products.length;
  const lowStock = inventory.filter((record) => record.quantity <= record.threshold).length;
  const todayRevenue = sales
    .filter((sale) => sale.created_at.slice(0, 10) === today())
    .reduce((sum, sale) => sum + Number(sale.total_amount), 0);
  const monthRevenue = sales
    .filter((sale) => sale.created_at.slice(0, 7) === today().slice(0, 7))
    .reduce((sum, sale) => sum + Number(sale.total_amount), 0);

  return {
    totalProducts,
    lowStock,
    todayRevenue: Number(todayRevenue.toFixed(2)),
    monthRevenue: Number(monthRevenue.toFixed(2)),
    topMovingProducts: listProducts()
      .slice(0, 5)
      .map((product) => ({ name: product.name, quantity: product.quantity })),
    recentAlerts: listAlerts().slice(0, 5),
  };
}

function listUsers() {
  return users.map((user) => ({
    ...clone(user),
    password: undefined,
  }));
}

function createUser(input) {
  const user = {
    id: nextUserId++,
    name: input.name,
    email: input.email,
    password: input.password ? bcrypt.hashSync(input.password, 10) : null,
    role: input.role || 'staff',
    google_id: null,
    created_at: now(),
  };
  users.push(user);
  return clone({ ...user, password: undefined });
}

function deleteUser(id) {
  const index = users.findIndex((user) => user.id === Number(id));
  if (index === -1) {
    return false;
  }
  users.splice(index, 1);
  return true;
}

function listCategories() {
  return clone(categories);
}

function createCategory(name) {
  const category = {
    id: nextCategoryId++,
    name,
  };
  categories.push(category);
  return clone(category);
}

module.exports = {
  addDays,
  authenticateUser,
  createCategory,
  createProduct,
  createUser,
  deleteProduct,
  deleteUser,
  ensureAlert,
  getDashboardStats,
  getProductInventory,
  getSaleDetail,
  listAlerts,
  listCategories,
  listInventory,
  listProducts,
  listSales,
  listUsers,
  markAllAlertsRead,
  markAlertRead,
  overrideQuantity,
  processSale,
  refreshAlertsForInventory,
  seedExpiryAlerts,
  today,
  updateProduct,
  upsertGoogleUser,
  addStock,
};
