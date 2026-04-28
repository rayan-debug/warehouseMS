const express = require('express');
const { param } = require('express-validator');
const { pool, query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { generateInvoicePdf } = require('../services/pdfService');
const { ensureAlert } = require('../services/alertService');
const { logActivity } = require('../services/activityLogger');

// Sales API: list/get sales, process new sales (with stock deduction +
// low-stock alerts), generate PDF invoices, and the Smart Suggestions endpoint
// that combines co-purchase mining with curated Lebanese-cuisine pairings.
const router = express.Router();

// Throw-friendly helper for 4xx errors raised inside transactions.
const clientError = (msg) => Object.assign(new Error(msg), { statusCode: 400 });

// Parse ?page=&limit= from the request, capped at 200 rows per page.
function parsePage(q) {
  const page  = Math.max(1, parseInt(q.page,  10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(q.limit, 10) || 50));
  return { page, limit, offset: (page - 1) * limit };
}

// Curated Lebanese-cuisine pairing rules used to seed suggestions when sales
// history is sparse. Each rule maps a cart-item name pattern to keywords that
// should be searched in the product catalog.
const LEBANESE_PAIRINGS = [
  { match: /hummus|foul|moudammas|mtabbal|mutabbal|baba.?gh?anouj/i, pair: ['pita', 'olive oil', 'pickle', 'mint', 'lemon', 'parsley'] },
  { match: /tabbouleh|fattoush/i, pair: ['pita', 'lemon', 'olive oil', 'sumac', 'pomegranate'] },
  { match: /kibbeh|kafta|shawarma|kebab|shish/i, pair: ['ayran', 'laban', 'pita', 'hot.*chili', 'tahini', 'pickle'] },
  { match: /falafel/i, pair: ['tahini', 'pita', 'pickle', 'parsley', 'tomato'] },
  { match: /manaqeesh.*zaatar|manakeesh.*zaatar|zaatar bread|zaatar.*stick/i, pair: ['ayran', 'olive', 'tomato', 'cucumber', 'tea', 'mint lemonade'] },
  { match: /manaqeesh.*jibneh|manakeesh.*jibneh|fatayer.*cheese/i, pair: ['mint lemonade', 'olive', 'ayran', 'tea'] },
  { match: /fatayer.*spinach/i, pair: ['ayran', 'lemon', 'sumac'] },
  { match: /maamoul|baklava|knafeh|namoura|barazek|ghraybeh|ladyfinger|nabulsie/i, pair: ['najjar', 'nescafé', 'earl grey', 'tea', 'sage', 'chamomile', 'rose water'] },
  { match: /pita|markouk|saj|sandwich.*loaf|sourdough|baguette|brioche|whole.?wheat/i, pair: ['hummus', 'labneh', 'olive', 'akkawi', 'halloumi', 'feta', 'butter'] },
  { match: /akkawi|halloumi|nabulsi|baladi.*cheese|kashkaval|majdouleh|shanklish|mozzarella|gouda|brie|emmental|cheddar|feta/i, pair: ['pita', 'tomato', 'mint', 'watermelon', 'olive', 'arak', 'wine'] },
  { match: /watermelon|honeydew|cantaloupe/i, pair: ['halloumi', 'akkawi', 'feta'] },
  { match: /arak/i, pair: ['olive', 'cucumber', 'tomato', 'mint', 'almond', 'pistachio', 'cheese', 'cherry tomato'] },
  { match: /almaza|gold beer|961 beer|batroun|heineken|amstel|carlsberg|corona|budweiser|laziza/i, pair: ['olive', 'pistachio', 'almond', 'sunflower seeds', 'cheese', 'pita chip'] },
  { match: /musar|ksara|kefraya|massaya|wine|rosé|blanc/i, pair: ['cheese', 'olive', 'walnut', 'almond', 'fig', 'date', 'baguette'] },
  { match: /coffee|nescafé|najjar|lavazza|dolce gusto|cappuccino|espresso/i, pair: ['maamoul', 'baklava', 'barazek', 'kaak', 'pound cake', 'biscuit'] },
  { match: /tea|chamomile|earl grey|green tea|sage|hibiscus|peppermint|cinnamon|licorice|ginger/i, pair: ['maamoul', 'kaak', 'biscuit', 'petit beurre', 'rusk'] },
  { match: /labneh|laban|yoghurt|ayran|kefir|tzatziki|spreadable/i, pair: ['cucumber', 'mint', 'garlic', 'olive oil', 'pita', 'zaatar'] },
  { match: /pomegranate/i, pair: ['walnut', 'yoghurt', 'tabbouleh', 'fattoush'] },
  { match: /sahlab/i, pair: ['pistachio', 'cinnamon', 'rose water', 'coconut'] },
  { match: /jallab|tamarind|carob|kharroub|mulberry|toot|rose water cordial|orange blossom/i, pair: ['pine nut', 'pistachio', 'almond'] },
  { match: /eggplant/i, pair: ['tahini', 'tomato', 'olive oil', 'pomegranate'] },
  { match: /grape leaves|warak/i, pair: ['yoghurt', 'lemon', 'mint', 'rice'] },
  { match: /molokhia|mloukhieh/i, pair: ['rice', 'lemon', 'onion', 'pita', 'vinegar'] },
  { match: /lentil/i, pair: ['onion', 'lemon', 'olive oil', 'cumin', 'pita'] },
  { match: /kishk|freekeh|bulgur|quinoa/i, pair: ['olive oil', 'onion', 'pita', 'yoghurt'] },
  { match: /chickpea|fava/i, pair: ['lemon', 'cumin', 'olive oil', 'pita', 'tahini'] },
  { match: /tomato|cucumber|onion|garlic|parsley|mint|coriander|dill|basil|arugula|watercress|purslane/i, pair: ['olive oil', 'lemon', 'pita', 'feta', 'sumac'] },
  { match: /milk|full.?fat|skimmed|uht|condensed|evaporated|cream/i, pair: ['cornflake', 'biscuit', 'coffee', 'tea', 'cocoa', 'sugar'] },
  { match: /strawberr|raspberr|blackberr|blueberr|kiwi|mango|papaya|passion|dragon|lychee|fig/i, pair: ['cream', 'yoghurt', 'mint', 'sugar'] },
  { match: /banana/i, pair: ['milk', 'yoghurt', 'cocoa', 'oat'] },
  { match: /date|raisin|dried.*apricot|dried.*fig/i, pair: ['walnut', 'almond', 'pistachio', 'tea', 'coffee'] },
  { match: /walnut|almond|pistachio|hazelnut|pine nut|sunflower|pumpkin seed/i, pair: ['date', 'fig', 'raisin', 'tea', 'coffee', 'arak'] },
];

// GET /api/sales/suggestions?product_ids=1,2,3
// Returns products most frequently bought alongside the given cart products,
// padded with curated Lebanese-cuisine pairings when sales history is sparse.
router.get('/suggestions', authenticate, async (req, res, next) => {
  try {
    const ids = String(req.query.product_ids || '')
      .split(',')
      .map(Number)
      .filter(Boolean);

    if (!ids.length) return res.json({ success: true, suggestions: [] });

    // Layer 1 — co-purchase mining from real sales history.
    const { rows: salesRows } = await query(`
      SELECT
        p.id,
        p.name,
        p.price,
        i.quantity          AS available,
        c.name              AS category_name,
        COUNT(DISTINCT si2.sale_id)::int AS score
      FROM sale_items si1
      JOIN sale_items si2
        ON  si2.sale_id    = si1.sale_id
        AND si2.product_id <> si1.product_id
      JOIN products   p ON p.id = si2.product_id
      JOIN inventory  i ON i.product_id = p.id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE si1.product_id = ANY($1)
        AND si2.product_id <> ALL($1)
        AND i.quantity > 0
      GROUP BY p.id, p.name, p.price, i.quantity, c.name
      ORDER BY score DESC
      LIMIT 5
    `, [ids]);

    const merged = salesRows.map((row) => ({ ...row, reason: 'sales' }));
    if (merged.length >= 5) {
      return res.json({ success: true, suggestions: merged });
    }

    // Layer 2 — Lebanese-cuisine curated pairings.
    const { rows: cartRows } = await query(
      'SELECT id, name FROM products WHERE id = ANY($1)', [ids]
    );

    const keywordWeight = new Map();
    for (const cartItem of cartRows) {
      for (const rule of LEBANESE_PAIRINGS) {
        if (rule.match.test(cartItem.name)) {
          for (const kw of rule.pair) {
            keywordWeight.set(kw, (keywordWeight.get(kw) || 0) + 1);
          }
        }
      }
    }

    if (keywordWeight.size) {
      const excludeIds = [...ids, ...merged.map((m) => m.id)];
      const patterns = [...keywordWeight.keys()].map((k) => `%${k}%`);

      const { rows: pairingRows } = await query(`
        SELECT
          p.id,
          p.name,
          p.price,
          i.quantity AS available,
          c.name     AS category_name
        FROM products p
        JOIN inventory i ON i.product_id = p.id
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE i.quantity > 0
          AND p.id <> ALL($1)
          AND p.name ILIKE ANY($2)
        LIMIT 60
      `, [excludeIds, patterns]);

      const scored = pairingRows.map((row) => {
        let pairScore = 0;
        const lower = row.name.toLowerCase();
        for (const [kw, weight] of keywordWeight) {
          if (lower.includes(kw.toLowerCase())) pairScore += weight;
        }
        return { ...row, score: pairScore, reason: 'pairing' };
      }).sort((a, b) => b.score - a.score);

      for (const row of scored) {
        if (merged.length >= 5) break;
        merged.push(row);
      }
    }

    return res.json({ success: true, suggestions: merged });
  } catch (err) {
    return next(err);
  }
});

// GET /api/sales — paginated sales list. Admins see all, staff see only their own.
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePage(req.query);
    const isAdmin = req.user.role === 'admin';
    const userFilter = isAdmin ? '' : 'WHERE s.user_id = $3';
    const countFilter = isAdmin ? '' : 'WHERE user_id = $1';
    const baseParams = [limit, offset];
    if (!isAdmin) baseParams.push(req.user.id);

    const [{ rows }, { rows: [{ count }] }] = await Promise.all([
      query(`
        SELECT s.id, s.user_id, u.name AS user_name,
               s.total_amount, s.notes, s.created_at,
               COUNT(si.id)::int AS items
        FROM sales s
        JOIN users u ON u.id = s.user_id
        LEFT JOIN sale_items si ON si.sale_id = s.id
        ${userFilter}
        GROUP BY s.id, u.name
        ORDER BY s.created_at DESC
        LIMIT $1 OFFSET $2
      `, baseParams),
      query(`SELECT COUNT(*)::int AS count FROM sales ${countFilter}`,
        isAdmin ? [] : [req.user.id]),
    ]);
    return res.json({
      success: true,
      sales: rows,
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/sales/:id — single sale with its line items.
router.get('/:id', authenticate, [
  param('id').isInt({ gt: 0 }).withMessage('Sale ID must be a positive integer.'),
], validate, async (req, res, next) => {
  try {
    const { rows: [sale] } = await query(
      `SELECT s.*, u.name AS user_name FROM sales s JOIN users u ON u.id = s.user_id WHERE s.id = $1`,
      [req.params.id]
    );
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found.' });
    const { rows: items } = await query(
      `SELECT si.*, p.name AS product_name
       FROM sale_items si JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = $1`,
      [req.params.id]
    );
    return res.json({ success: true, sale: { ...sale, items } });
  } catch (err) {
    return next(err);
  }
});

// POST /api/sales — process a sale atomically: validates each line item,
// row-locks inventory (FOR UPDATE) to prevent overselling, deducts stock,
// records sale_items, and fires low-stock alerts when needed.
router.post('/', authenticate, async (req, res, next) => {
  const items = req.body.items || [];
  if (!items.length) {
    return res.status(400).json({ success: false, message: 'Sale must contain at least one item.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let totalAmount = 0;
    const validated = [];

    for (const item of items) {
      const qty = Number(item.quantity);
      if (!item.product_id || !Number.isInteger(qty) || qty <= 0) {
        throw clientError('Invalid item: product_id and quantity > 0 are required.');
      }

      const { rows } = await client.query(
        `SELECT i.id AS inv_id, i.quantity AS available, i.threshold,
                p.name, p.id AS product_id, p.price
         FROM inventory i
         JOIN products p ON p.id = i.product_id
         WHERE p.id = $1
         FOR UPDATE`,
        [item.product_id]
      );
      const inv = rows[0];
      if (!inv) throw clientError(`Product ${item.product_id} not found in inventory.`);
      if (inv.available < qty) throw clientError(`Insufficient stock for "${inv.name}" (${inv.available} available).`);

      const price = Number(inv.price);
      totalAmount += qty * price;
      validated.push({ ...inv, qty, price });
    }

    const { rows: [sale] } = await client.query(
      `INSERT INTO sales (user_id, total_amount, notes)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.user.id, totalAmount.toFixed(2), req.body.notes || null]
    );

    for (const item of validated) {
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, price_at_sale)
         VALUES ($1, $2, $3, $4)`,
        [sale.id, item.product_id, item.qty, item.price]
      );
      await client.query(
        `UPDATE inventory SET quantity = quantity - $1, last_updated = NOW() WHERE id = $2`,
        [item.qty, item.inv_id]
      );
      if (item.available - item.qty <= item.threshold) {
        await ensureAlert(client.query.bind(client), item.inv_id, 'low', `"${item.name}" is running low.`);
      }
    }

    await client.query('COMMIT');

    const { rows: [detail] } = await query(
      `SELECT s.*, u.name AS user_name FROM sales s JOIN users u ON u.id = s.user_id WHERE s.id = $1`,
      [sale.id]
    );
    const { rows: saleItems } = await query(
      `SELECT si.*, p.name AS product_name
       FROM sale_items si JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = $1`,
      [sale.id]
    );

    logActivity(req.user.id, 'Processed sale', `Sale #${sale.id} — ${validated.length} item(s), total $${totalAmount.toFixed(2)}`);
    return res.status(201).json({ success: true, sale: { ...detail, items: saleItems } });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    return next(err);
  } finally {
    client.release();
  }
});

// GET /api/sales/:id/invoice — stream a generated PDF invoice for the sale.
router.get('/:id/invoice', authenticate, [
  param('id').isInt({ gt: 0 }).withMessage('Sale ID must be a positive integer.'),
], validate, async (req, res, next) => {
  try {
    const { rows: [sale] } = await query(
      `SELECT s.*, u.name AS user_name FROM sales s JOIN users u ON u.id = s.user_id WHERE s.id = $1`,
      [req.params.id]
    );
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found.' });
    const { rows: saleItems } = await query(
      `SELECT si.*, p.name AS product_name
       FROM sale_items si JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = $1`,
      [req.params.id]
    );
    return generateInvoicePdf(res, { ...sale, items: saleItems });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
