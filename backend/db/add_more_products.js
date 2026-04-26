require('dotenv').config();
const { Client } = require('pg');

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// [name, description, price, quantity, threshold, expiry_days|null]
const MORE_BEVERAGES = [
  ['Coca-Cola 330 ml', 'Cola carbonated drink can, 330 ml', 1.75, 250, 45, 180],
  ['Coca-Cola 1.5 L', 'Cola carbonated drink bottle, 1.5 L', 3.25, 200, 35, 180],
  ['Coca-Cola Zero 330 ml', 'Sugar-free cola can, 330 ml', 1.75, 220, 38, 180],
  ['Diet Coke 330 ml', 'Diet cola can, 330 ml', 1.75, 200, 35, 180],
  ['Fanta Orange 330 ml', 'Orange-flavoured carbonated drink, 330 ml', 1.75, 220, 38, 180],
  ['Fanta Strawberry 330 ml', 'Strawberry-flavoured soda, 330 ml', 1.75, 200, 35, 180],
  ['Schweppes Tonic 330 ml', 'Tonic water can, 330 ml', 2.00, 160, 28, 180],
  ['Schweppes Bitter Lemon 330 ml', 'Bitter lemon soda, 330 ml', 2.00, 150, 25, 180],
  ['Schweppes Pomegranate 330 ml', 'Pomegranate soda, 330 ml', 2.25, 140, 24, 180],
  ['Schweppes Ginger Ale 330 ml', 'Ginger ale carbonated drink, 330 ml', 2.00, 145, 25, 180],
  ['Power Horse Energy 250 ml', 'Austrian energy drink can, 250 ml', 4.50, 110, 20, 730],
  ['XL Energy Drink 250 ml', 'Energy drink can, 250 ml', 4.00, 105, 18, 730],
  ['Bison Energy 250 ml', 'Energy drink can, 250 ml', 3.75, 100, 18, 730],
  ['Capri-Sun Orange 200 ml', 'Orange juice pouch, 200 ml', 1.25, 200, 35, 180],
  ['Capri-Sun Apple 200 ml', 'Apple juice pouch, 200 ml', 1.25, 200, 35, 180],
  ['Maaza Mango 1 L', 'Indian mango juice drink, 1 L', 4.00, 110, 20, 180],
  ['Tropicana Apple 1 L', 'Pure apple juice, 1 L', 5.50, 90, 15, 14],
  ['Tropicana Multivitamin 1 L', 'Multi-vitamin juice, 1 L', 6.00, 80, 14, 14],
  ['Cappy Orange 1 L', 'Orange juice drink, 1 L', 4.50, 100, 18, 90],
  ['Cappy Pineapple 1 L', 'Pineapple juice drink, 1 L', 4.50, 95, 16, 90],
  ['Del Monte Pineapple Juice 1 L', 'Pineapple juice carton, 1 L', 5.00, 90, 15, 180],
  ['Yamama Cocktail Juice 1 L', 'Mixed-fruit cocktail juice drink, 1 L', 3.75, 110, 20, 90],
  ['Vimto Cordial 710 ml', 'Mixed-berry concentrate syrup, 710 ml', 6.50, 70, 12, 730],
  ['Aquafina Water 500 ml', 'Purified drinking water, 500 ml', 1.25, 320, 55, 730],
  ['Aquafina Water 1.5 L', 'Purified drinking water, 1.5 L', 1.75, 260, 45, 730],
  ['Nestlé Pure Life 500 ml', 'Purified drinking water, 500 ml', 1.00, 350, 60, 730],
  ['Nestlé Pure Life 1.5 L', 'Purified drinking water, 1.5 L', 1.50, 280, 50, 730],
  ['Volvic Mineral Water 1 L', 'French volcanic spring water, 1 L', 3.25, 110, 18, 730],
  ['Vichy Mineral Water 500 ml', 'French sparkling mineral water, 500 ml', 3.50, 90, 15, 730],
  ['Carob Drink (Kharroub) 500 ml', 'Lebanese carob cordial drink, 500 ml', 4.50, 80, 14, 180],
  ['Mulberry Syrup (Toot) 500 ml', 'Lebanese mulberry cordial, 500 ml', 5.00, 70, 12, 365],
  ['Sahlab Powder 200 g', 'Hot Lebanese milk drink mix, 200 g', 4.50, 90, 15, 365],
  ['Vimto Sparkling 250 ml', 'Vimto sparkling can, 250 ml', 1.75, 160, 28, 180],
  ['Tang Mango Powder 500 g', 'Instant mango drink mix, 500 g', 5.00, 75, 12, 730],
  ['Tang Pineapple Powder 500 g', 'Instant pineapple drink mix, 500 g', 5.00, 70, 12, 730],
  ['Sanpellegrino Aranciata 330 ml', 'Italian sparkling orange drink, 330 ml', 3.00, 100, 18, 365],
  ['Sanpellegrino Limonata 330 ml', 'Italian sparkling lemonade, 330 ml', 3.00, 95, 16, 365],
  ['Nestea Lemon 500 ml', 'Lemon iced tea bottle, 500 ml', 3.00, 130, 22, 180],
  ['Nestea Peach 500 ml', 'Peach iced tea bottle, 500 ml', 3.00, 125, 22, 180],
  ['Snapple Peach Tea 473 ml', 'American peach iced tea, 473 ml', 4.00, 80, 14, 180],
  ['Lipton Green Citrus 500 ml', 'Citrus iced green tea, 500 ml', 3.50, 100, 18, 180],
  ['Yakult Probiotic ×5 65 ml', 'Probiotic dairy drinks ×5, 325 ml', 4.50, 90, 15, 30],
  ['Alpro Soy Milk Vanilla 1 L', 'Plant-based vanilla soy milk, 1 L', 6.50, 70, 12, 180],
  ['Alpro Almond Milk 1 L', 'Unsweetened almond drink, 1 L', 6.75, 65, 12, 180],
  ['Oatly Oat Milk 1 L', 'Original oat drink, 1 L', 7.00, 60, 10, 180],
  ['Vita Coco Coconut Drink 1 L', 'Pure coconut water carton, 1 L', 7.50, 55, 10, 180],
  ['Rice Dream Original 1 L', 'Plant-based rice drink, 1 L', 6.25, 50, 10, 180],
  ['Activia Drinking Yoghurt 200 ml', 'Strawberry probiotic yoghurt drink, 200 ml', 2.25, 130, 22, 21],
  ['Smoothie Strawberry-Banana 250 ml', 'Fruit smoothie bottle, 250 ml', 4.00, 80, 14, 7],
  ['Smoothie Mango-Passion 250 ml', 'Tropical fruit smoothie, 250 ml', 4.25, 75, 12, 7],
];

const MORE_PRODUCE = [
  ['Vine Tomatoes 1 kg', 'On-vine cluster tomatoes, 1 kg', 3.25, 130, 22, 7],
  ['Beef Tomatoes 1 kg', 'Large beef tomatoes for slicing, 1 kg', 3.50, 110, 18, 7],
  ['Roma Tomatoes 1 kg', 'Plum tomatoes for sauce, 1 kg', 2.75, 140, 24, 7],
  ['English Cucumbers ×3', 'Long seedless cucumbers, ×3', 3.00, 110, 20, 10],
  ['Yellow Bell Pepper 500 g', 'Yellow sweet peppers, 500 g', 3.25, 90, 15, 7],
  ['Orange Bell Pepper 500 g', 'Orange sweet peppers, 500 g', 3.50, 85, 15, 7],
  ['Red Onions 1 kg', 'Sweet red onions, 1 kg', 2.25, 150, 26, 30],
  ['White Onions 1 kg', 'Mild white onions, 1 kg', 2.00, 140, 24, 30],
  ['Shallots 500 g', 'French-style shallots, 500 g', 4.00, 80, 14, 30],
  ['Baby Carrots 500 g', 'Sweet baby carrots, 500 g', 2.75, 120, 22, 14],
  ['Purple Carrots 500 g', 'Heirloom purple carrots, 500 g', 3.50, 70, 12, 14],
  ['Daikon Radish 500 g', 'Long white radish, 500 g', 3.25, 60, 10, 14],
  ['Asparagus Bunch', 'Fresh green asparagus, ~250 g', 5.50, 70, 12, 5],
  ['Brussels Sprouts 500 g', 'Fresh Brussels sprouts, 500 g', 4.25, 75, 12, 10],
  ['Bok Choy Bunch', 'Chinese leaf bok choy, ~400 g', 3.00, 65, 10, 5],
  ['Curly Kale Bunch', 'Fresh curly kale leaves, ~300 g', 3.25, 70, 12, 5],
  ['Mâche Lamb Lettuce 100 g', 'Tender lamb lettuce, 100 g', 3.50, 55, 10, 4],
  ['Belgian Endive 250 g', 'Bitter chicory endive, 250 g', 3.75, 60, 10, 7],
  ['Frisée Lettuce', 'Curly frisée lettuce head, ~400 g', 3.50, 55, 10, 5],
  ['Mixed Salad Leaves 200 g', 'Ready-washed leaf mix, 200 g', 3.25, 90, 15, 4],
  ['Spaghetti Squash 1 kg', 'Yellow spaghetti squash, 1 kg', 3.50, 50, 8, 21],
  ['Acorn Squash Each', 'Green acorn squash, ~700 g', 3.25, 55, 10, 21],
  ['Patty Pan Squash 500 g', 'Mini scallop squash, 500 g', 3.00, 50, 10, 7],
  ['Yam 1 kg', 'Tropical yam tuber, 1 kg', 4.50, 60, 10, 30],
  ['Cassava Root 1 kg', 'Fresh cassava (yuca), 1 kg', 4.25, 55, 10, 14],
  ['Fresh Ginger 250 g', 'Fresh ginger root, 250 g', 3.50, 100, 18, 30],
  ['Fresh Turmeric 250 g', 'Fresh turmeric root, 250 g', 4.50, 60, 10, 30],
  ['Galangal 100 g', 'Fresh galangal rhizome, 100 g', 3.75, 40, 8, 21],
  ['Lemongrass Bunch', 'Fresh lemongrass stalks, ~150 g', 2.75, 60, 10, 10],
  ['Tarragon Bunch', 'Fresh tarragon herb, ~80 g', 2.25, 50, 10, 5],
  ['Chives Bunch', 'Fresh chives, ~100 g', 1.75, 70, 12, 5],
  ['Marjoram Bunch', 'Fresh marjoram herb, ~80 g', 1.75, 55, 10, 5],
  ['Bay Leaves Fresh 50 g', 'Fresh laurel bay leaves, 50 g', 2.50, 60, 10, 14],
  ['Edamame Pods 250 g', 'Fresh soybean pods, 250 g', 4.00, 70, 12, 7],
  ['Snow Peas 250 g', 'Flat snow pea pods, 250 g', 3.50, 65, 10, 5],
  ['Sugar Snap Peas 250 g', 'Sweet snap peas, 250 g', 3.75, 60, 10, 5],
  ['Sweet Cherries 500 g', 'Fresh red sweet cherries, 500 g', 7.50, 70, 12, 5],
  ['Sour Cherries 500 g', 'Fresh tart cherries, 500 g', 7.00, 60, 10, 5],
  ['Black Grapes 500 g', 'Seedless black grapes, 500 g', 5.00, 80, 14, 7],
  ['Red Grapes 500 g', 'Seedless red grapes, 500 g', 4.75, 85, 15, 7],
  ['Cantaloupe Half', 'Cantaloupe melon half, ~1.5 kg', 4.00, 50, 10, 5],
  ['Persimmon (Kaki) 500 g', 'Sweet kaki persimmons, 500 g', 4.50, 60, 10, 7],
  ['Yellow Plums 500 g', 'Sweet yellow plums, 500 g', 4.25, 65, 10, 7],
  ['Nectarines 500 g', 'Smooth-skin nectarines, 500 g', 4.50, 70, 12, 7],
  ['White Peaches 500 g', 'White-flesh peaches, 500 g', 5.00, 60, 10, 7],
  ['Quince 500 g', 'Aromatic quince fruit, 500 g', 4.25, 50, 10, 14],
  ['Cactus Pear (Sabra) ×4', 'Lebanese prickly pears, ×4', 4.00, 60, 10, 7],
  ['Green Almonds (Loz Akhdar) 500 g', 'Fresh seasonal green almonds, 500 g', 8.00, 40, 8, 5],
  ['Green Walnuts (Joz Akhdar) 500 g', 'Fresh seasonal green walnuts, 500 g', 9.00, 35, 8, 5],
  ['Green Chickpeas (Mleihi) 500 g', 'Fresh seasonal green chickpeas, 500 g', 5.00, 45, 8, 4],
];

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows: cats } = await client.query('SELECT id, name FROM categories');
    const catMap = Object.fromEntries(cats.map((c) => [c.name, c.id]));

    let added = 0;

    async function insertCategory(catName, items) {
      const catId = catMap[catName];
      let catAdded = 0;
      let catSkipped = 0;
      for (const [name, description, price, quantity, threshold, expiryDays] of items) {
        const { rows } = await client.query('SELECT id FROM products WHERE name = $1', [name]);
        if (rows.length) { catSkipped++; continue; }
        const { rows: [p] } = await client.query(
          'INSERT INTO products (name, description, category_id, price) VALUES ($1,$2,$3,$4) RETURNING id',
          [name, description, catId, price]
        );
        const expiry = expiryDays !== null ? addDays(expiryDays) : null;
        await client.query(
          'INSERT INTO inventory (product_id, quantity, threshold, expiry_date) VALUES ($1,$2,$3,$4)',
          [p.id, quantity, threshold, expiry]
        );
        catAdded++;
        added++;
      }
      console.log(`  ${catName}: +${catAdded} new (${catSkipped} already present)`);
    }

    await insertCategory('Beverages', MORE_BEVERAGES);
    await insertCategory('Produce', MORE_PRODUCE);

    console.log(`\nDone. Total added: ${added}`);
  } finally {
    await client.end();
  }
}

run().catch((e) => { console.error(e.message); process.exit(1); });
