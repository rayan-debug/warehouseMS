require('dotenv').config();
const { Client } = require('pg');

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// [name, description, price, quantity, threshold, expiry_days|null]
const NEW_BEVERAGES = [
  ['961 Beer 330 ml', 'Lebanese craft lager can, 330 ml', 5.50, 120, 20, 180],
  ['961 Beer IPA 330 ml', 'Lebanese craft IPA can, 330 ml', 6.50, 90, 15, 180],
  ['Batroun Mountains Lager 330 ml', 'Lebanese mountain-brewed lager, 330 ml', 5.00, 100, 18, 180],
  ['Château Kefraya Red 750 ml', 'Bekaa Valley red wine, 750 ml', 28.00, 35, 6, null],
  ['Château Kefraya Blanc de Blancs 750 ml', 'Crisp Bekaa white wine, 750 ml', 25.00, 30, 5, null],
  ['Massaya Classic Red 750 ml', 'Tanail estate red wine, 750 ml', 22.00, 30, 5, null],
  ['Massaya Silver Selection 750 ml', 'Premium Bekaa white wine, 750 ml', 24.00, 25, 5, null],
  ['Château Ksara Rosé 750 ml', 'Dry Bekaa rosé wine, 750 ml', 20.00, 35, 6, null],
  ['Heineken 330 ml', 'Dutch pilsner lager can, 330 ml', 4.50, 150, 25, 180],
  ['Amstel 330 ml', 'Dutch lager can, 330 ml', 4.00, 140, 24, 180],
  ['Carlsberg 330 ml', 'Danish pilsner can, 330 ml', 4.25, 130, 22, 180],
  ['Corona Extra 355 ml', 'Mexican lager bottle, 355 ml', 5.75, 110, 18, 180],
  ['Budweiser 330 ml', 'American lager can, 330 ml', 4.00, 130, 22, 180],
  ['Bonjus Orange 250 ml', 'Lebanese orange-flavour drink, 250 ml', 1.50, 200, 36, 180],
  ['Bonjus Lemon 250 ml', 'Lebanese lemon-flavour drink, 250 ml', 1.50, 190, 32, 180],
  ['Bonjus Cocktail 250 ml', 'Mixed tropical fruit drink, 250 ml', 1.50, 180, 30, 180],
  ['Tang Orange Powder 500 g', 'Instant orange drink mix, 500 g', 5.00, 80, 14, 730],
  ['Milo Powder 400 g', 'Chocolate malt energy drink powder, 400 g', 9.50, 70, 12, 730],
  ['Nesquik Chocolate 400 g', 'Instant chocolate milk powder, 400 g', 8.75, 65, 12, 730],
  ['Ovaltine 400 g', 'Malt chocolate powder drink, 400 g', 8.00, 60, 10, 730],
  ['Nescafé Gold 200 g', 'Premium freeze-dried coffee, 200 g', 16.00, 55, 10, 730],
  ['Nescafé Cappuccino ×10', 'Instant cappuccino sachets, ×10', 7.50, 80, 15, 730],
  ['Lavazza Espresso 250 g', 'Ground espresso coffee, 250 g', 13.00, 45, 8, 730],
  ['Dolce Gusto Pods ×16', 'Compatible coffee capsules, ×16', 14.00, 40, 8, 730],
  ['Lipton Yellow Tea ×25', 'Classic black tea bags, ×25', 4.75, 90, 16, 730],
  ['Twinings English Breakfast ×25', 'Premium black tea bags, ×25', 7.50, 75, 12, 730],
  ['Licorice Tea (Sous) 20 bags', 'Sweet anise-licorice herbal tea, ×20', 4.50, 70, 12, 730],
  ['Hibiscus Tea (Karkade) 20 bags', 'Dried hibiscus flower tea, ×20', 4.75, 65, 10, 730],
  ['Ginger Lemon Tea ×20', 'Spiced ginger-lemon herbal tea, ×20', 5.00, 65, 10, 730],
  ['Peppermint Tea ×20', 'Pure peppermint leaf tea, ×20', 4.50, 70, 12, 730],
  ['Cinnamon Stick Tea ×20', 'Dried cinnamon bark infusion, ×20', 4.75, 60, 10, 730],
  ['Hot Chocolate Powder 400 g', 'Rich cocoa drink mix, 400 g', 7.50, 65, 10, 730],
  ['Sannine Water 500 ml', 'Sannine still mineral water, 500 ml', 1.25, 320, 55, 730],
  ['Sannine Sparkling 500 ml', 'Sannine sparkling mineral water, 500 ml', 1.75, 200, 35, 730],
  ['Acqua Panna 500 ml', 'Italian still mineral water, 500 ml', 2.75, 120, 20, 730],
  ['San Pellegrino 500 ml', 'Italian sparkling mineral water, 500 ml', 3.25, 100, 18, 730],
  ['Perrier 330 ml', 'French sparkling mineral water, 330 ml', 3.00, 110, 20, 730],
  ['Evian 500 ml', 'French natural spring water, 500 ml', 2.50, 130, 22, 730],
  ['Gatorade Blue 500 ml', 'Cool Blue sports drink, 500 ml', 4.50, 90, 15, 365],
  ['Powerade Mountain Blast 500 ml', 'Isotonic sports drink, 500 ml', 4.25, 85, 14, 365],
  ['Lipton Ice Tea Peach 500 ml', 'Peach-flavoured iced tea, 500 ml', 3.25, 140, 24, 180],
  ['Lipton Ice Tea Lemon 500 ml', 'Lemon-flavoured iced tea, 500 ml', 3.25, 135, 22, 180],
  ['Iced Coffee Mocha 250 ml', 'Ready-to-drink iced mocha coffee, 250 ml', 4.50, 80, 14, 90],
  ['Iced Coffee Latte 250 ml', 'Ready-to-drink iced latte, 250 ml', 4.50, 75, 12, 90],
  ['Doogh Sparkling 330 ml', 'Sparkling salted yoghurt drink, 330 ml', 2.75, 90, 15, 21],
  ['Guava Nectar 1 L', 'Tropical guava juice drink, 1 L', 4.25, 100, 18, 180],
  ['Pear Nectar 1 L', 'Pear juice drink, 1 L', 4.25, 95, 16, 180],
  ['Strawberry Nectar 1 L', 'Strawberry juice drink, 1 L', 4.50, 100, 18, 180],
  ['Red Bull Tropical 250 ml', 'Tropical edition energy drink, 250 ml', 6.00, 90, 15, 730],
  ['Celsius Energy Drink 355 ml', 'Sparkling fitness energy drink, 355 ml', 5.50, 85, 14, 730],
];

const NEW_PRODUCE = [
  ['Radish Bunch', 'Fresh red radishes, ~300 g', 1.25, 90, 18, 5],
  ['Turnip 1 kg', 'Fresh white turnips, 1 kg', 1.75, 80, 14, 14],
  ['Leek Bunch', 'Fresh leeks, ~400 g', 2.50, 70, 12, 7],
  ['Celery Bunch', 'Fresh celery stalks, ~500 g', 2.25, 80, 14, 7],
  ['Fennel Bulb', 'Anise-flavoured fennel bulb, ~400 g', 3.00, 60, 10, 7],
  ['Pumpkin 1 kg', 'Orange pumpkin flesh, 1 kg', 2.50, 70, 12, 14],
  ['Butternut Squash 1 kg', 'Sweet butternut squash, 1 kg', 2.75, 65, 10, 14],
  ['Kohlrabi 500 g', 'Fresh kohlrabi bulbs, 500 g', 2.50, 55, 10, 10],
  ['Swiss Chard Bunch', 'Rainbow Swiss chard, ~300 g', 2.00, 70, 12, 5],
  ['Arugula Bunch', 'Fresh peppery rocket leaves, ~150 g', 2.25, 80, 14, 4],
  ['Watercress Bunch', 'Fresh watercress sprigs, ~200 g', 2.00, 65, 10, 4],
  ['Dill Bunch', 'Fresh dill herb, ~100 g', 1.25, 80, 15, 5],
  ['Coriander Bunch', 'Fresh cilantro, ~150 g', 1.00, 90, 18, 5],
  ['Rosemary Bunch', 'Fresh rosemary sprigs, ~80 g', 1.50, 65, 10, 7],
  ['Basil Bunch', 'Fresh sweet basil, ~100 g', 1.75, 70, 12, 5],
  ['Sage Bunch', 'Fresh maryamiyeh sage, ~80 g', 1.75, 55, 10, 7],
  ['Purslane (Bakleh) Bunch', 'Fresh purslane herb, ~200 g', 1.25, 70, 12, 4],
  ['Molokhia Bunch', 'Fresh jute leaf, ~300 g', 2.00, 60, 10, 3],
  ['Grape Leaves 200 g', 'Fresh vine leaves for stuffing, 200 g', 4.00, 50, 8, 5],
  ['Courgette Flowers ×10', 'Fresh zucchini blossoms, ×10', 5.00, 30, 6, 2],
  ['Avocado Each', 'Ripe Hass avocado, each ~200 g', 3.50, 80, 14, 7],
  ['Mango 1 kg', 'Sweet Alphonso mangoes, 1 kg', 6.00, 70, 12, 7],
  ['Kiwi 500 g', 'Green kiwi fruits, 500 g', 4.50, 75, 12, 14],
  ['Pineapple Each', 'Fresh whole pineapple, ~1 kg', 5.50, 40, 8, 7],
  ['Papaya 500 g', 'Ripe red papaya, 500 g', 4.00, 45, 8, 5],
  ['Passion Fruit ×4', 'Fresh purple passion fruits, ×4', 4.50, 40, 8, 7],
  ['Dragon Fruit Each', 'Red dragon fruit, each ~300 g', 7.00, 25, 5, 7],
  ['Lychee 250 g', 'Fresh lychee fruits, 250 g', 6.50, 30, 6, 5],
  ['Raspberry 125 g', 'Fresh raspberries, 125 g', 6.00, 40, 8, 3],
  ['Blackberries 125 g', 'Fresh blackberries, 125 g', 6.00, 35, 7, 3],
  ['Blueberries 125 g', 'Fresh blueberries, 125 g', 7.00, 40, 8, 5],
  ['Mulberries 200 g', 'Fresh Lebanese white mulberries, 200 g', 4.50, 30, 6, 2],
  ['Dates Medjool 500 g', 'Premium soft Medjool dates, 500 g', 12.00, 60, 10, 90],
  ['Dates Deglet 500 g', 'Semi-dry Deglet Nour dates, 500 g', 7.00, 65, 10, 90],
  ['Dried Figs 250 g', 'Sun-dried Lebanese figs, 250 g', 5.50, 70, 12, 180],
  ['Dried Apricots 250 g', 'Unsulfured dried apricots, 250 g', 5.00, 70, 12, 180],
  ['Golden Raisins 250 g', 'Seedless golden sultana raisins, 250 g', 4.50, 75, 12, 180],
  ['Walnuts 250 g', 'Lebanese mountain walnuts, 250 g', 8.00, 65, 10, 180],
  ['Almonds 250 g', 'Raw natural almonds, 250 g', 7.50, 65, 10, 180],
  ['Pistachios 250 g', 'Lebanese roasted pistachios, 250 g', 11.00, 60, 10, 180],
  ['Pine Nuts 100 g', 'Lebanese pine nuts, 100 g', 9.00, 55, 10, 90],
  ['Hazelnuts 250 g', 'Raw hazelnuts, 250 g', 7.00, 55, 10, 180],
  ['Dried Chickpeas 500 g', 'Dry chickpeas for hummus, 500 g', 3.50, 90, 15, 365],
  ['Green Lentils 500 g', 'Whole green lentils, 500 g', 3.25, 85, 14, 365],
  ['Red Lentils 500 g', 'Split red lentils, 500 g', 3.00, 90, 15, 365],
  ['Dried Fava Beans 500 g', 'Large dried fava beans, 500 g', 3.25, 80, 14, 365],
  ['Bulgur Coarse 500 g', 'Coarse cracked wheat, 500 g', 3.50, 80, 14, 365],
  ['Freekeh 500 g', 'Roasted green wheat, 500 g', 5.50, 65, 10, 365],
  ['Quinoa 400 g', 'Organic white quinoa, 400 g', 8.00, 55, 10, 365],
  ['Sunflower Seeds 200 g', 'Roasted salted sunflower seeds, 200 g', 3.00, 90, 15, 365],
  ['Pumpkin Seeds 200 g', 'Raw pumpkin seeds, 200 g', 3.50, 80, 14, 365],
];

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows: cats } = await client.query('SELECT id, name FROM categories');
    const catMap = Object.fromEntries(cats.map((c) => [c.name, c.id]));

    let added = 0;
    let skipped = 0;

    async function insertCategory(catName, items) {
      const catId = catMap[catName];
      for (const [name, description, price, quantity, threshold, expiryDays] of items) {
        const { rows } = await client.query('SELECT id FROM products WHERE name = $1', [name]);
        if (rows.length) { skipped++; continue; }
        const { rows: [p] } = await client.query(
          'INSERT INTO products (name, description, category_id, price) VALUES ($1,$2,$3,$4) RETURNING id',
          [name, description, catId, price]
        );
        const expiry = expiryDays !== null
          ? addDays(expiryDays)
          : null;
        await client.query(
          'INSERT INTO inventory (product_id, quantity, threshold, expiry_date) VALUES ($1,$2,$3,$4)',
          [p.id, quantity, threshold, expiry]
        );
        added++;
      }
      console.log(`  ${catName}: +${items.length - skipped} new`);
      skipped = 0;
    }

    await insertCategory('Beverages', NEW_BEVERAGES);
    await insertCategory('Produce', NEW_PRODUCE);

    console.log(`\nDone. Total added: ${added}`);
  } finally {
    await client.end();
  }
}

run().catch((e) => { console.error(e.message); process.exit(1); });
