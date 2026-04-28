// Database seeder — TRUNCATEs every domain table then inserts the canonical
// catalog of categories, demo users, and 303 Lebanese-supermarket products
// defined in PRODUCTS below. DESTRUCTIVE — only run on a fresh DB or when a
// full reset is intentional. Invoke via `npm run seed`.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const logger = require('../config/logger');

// Helper for synthetic expiry dates: today + N days, ISO yyyy-mm-dd.
function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// [name, description, price (USD), quantity, threshold, expiry_days|null]
const PRODUCTS = {
  Dairy: [
    ['Laban Ayran 1 L', 'Lebanese-style drinking yoghurt, 1 L', 4.50, 120, 20, 30],
    ['Labneh Baladiyeh 500 g', 'Strained yoghurt cheese, 500 g', 7.25, 95, 15, 21],
    ['Kishk Powder 250 g', 'Dried fermented wheat-yoghurt powder, 250 g', 9.50, 60, 10, 180],
    ['Akkawi Cheese 500 g', 'Mild white brine cheese, 500 g', 11.00, 80, 15, 30],
    ['Halloumi Cheese 250 g', 'Grilling cheese, 250 g', 13.50, 75, 12, 45],
    ['Baladi White Cheese 500 g', 'Traditional fresh white cheese, 500 g', 8.75, 90, 15, 21],
    ['Shanklish Cheese 200 g', 'Aged spiced cheese ball, 200 g', 12.00, 55, 10, 60],
    ['Boiled Labneh 400 g', 'Cooked strained yoghurt, 400 g', 6.50, 70, 12, 14],
    ['Full-Fat Milk 1 L', 'Pasteurised full-fat cow milk, 1 L', 3.75, 200, 30, 10],
    ['Skimmed Milk 1 L', 'Low-fat pasteurised milk, 1 L', 3.50, 150, 25, 10],
    ['UHT Milk 1 L', 'Long-life full-fat milk, 1 L', 4.00, 300, 40, 180],
    ['Butter 200 g', 'Unsalted pure butter block, 200 g', 8.00, 85, 15, 90],
    ['Ghee 500 g', 'Clarified butter, 500 g', 14.00, 60, 10, 365],
    ['Crème Fraîche 200 ml', 'Fresh thick cream, 200 ml', 5.50, 70, 12, 14],
    ['Heavy Cream 250 ml', 'Double whipping cream, 250 ml', 6.00, 65, 10, 14],
    ['Yoghurt Plain 500 g', 'Full-fat set yoghurt, 500 g', 4.25, 110, 20, 14],
    ['Yoghurt Strawberry 150 g', 'Fruit yoghurt cup, 150 g', 2.75, 130, 20, 14],
    ['Processed Cheese Slices 200 g', 'Melting cheese slices ×10, 200 g', 7.00, 90, 15, 60],
    ['Cream Cheese 200 g', 'Spreadable cream cheese, 200 g', 8.50, 75, 12, 30],
    ['Majdouleh Cheese 250 g', 'Braided string cheese, 250 g', 10.50, 65, 12, 30],
    ['Nabulsi Cheese 500 g', 'Semi-hard white cheese, 500 g', 12.50, 60, 10, 30],
    ['Mozzarella Block 500 g', 'Block mozzarella for cooking, 500 g', 11.00, 70, 12, 30],
    ['Ricotta 250 g', 'Soft whey cheese, 250 g', 9.00, 55, 10, 14],
    ['Sour Cream 200 ml', 'Cultured cream, 200 ml', 5.75, 60, 10, 21],
    ['Condensed Milk 397 g', 'Sweetened condensed milk tin, 397 g', 6.25, 100, 15, 730],
    ['Evaporated Milk 410 g', 'Unsweetened evaporated milk tin, 410 g', 5.50, 90, 15, 730],
    ['Milk Powder 400 g', 'Full-fat powdered milk, 400 g', 12.00, 70, 12, 365],
    ['Kefir 500 ml', 'Fermented milk drink, 500 ml', 5.00, 55, 10, 21],
    ['Goat Milk 500 ml', 'Fresh pasteurised goat milk, 500 ml', 7.50, 40, 8, 7],
    ['Camel Milk 250 ml', 'Pure camel milk, 250 ml', 18.00, 25, 5, 7],
    ['Chocolate Milk 200 ml', 'Chocolate-flavoured milk drink, 200 ml', 3.25, 150, 25, 21],
    ['Strawberry Milk 200 ml', 'Strawberry-flavoured milk drink, 200 ml', 3.25, 140, 25, 21],
    ['Banana Milk 200 ml', 'Banana-flavoured milk drink, 200 ml', 3.25, 130, 25, 21],
    ['Buttermilk 500 ml', 'Cultured buttermilk, 500 ml', 4.50, 50, 10, 14],
    ['Clotted Cream (Qishta) 200 g', 'Thick Lebanese clotted cream, 200 g', 7.00, 65, 12, 14],
    ['Manakir Cheese 250 g', 'Mini fresh white cheese balls, 250 g', 9.50, 55, 10, 21],
    ['Kashkaval Cheese 300 g', 'Yellow semi-hard cheese, 300 g', 13.00, 50, 10, 60],
    ['Parmesan Grated 100 g', 'Grated Parmesan cheese sachet, 100 g', 8.00, 60, 10, 180],
    ['Cheddar Slices 200 g', 'Mature cheddar slices, 200 g', 9.50, 70, 12, 60],
    ['Feta Cheese 200 g', 'Crumbled feta in brine, 200 g', 10.00, 65, 12, 60],
    ['Brie Wedge 125 g', 'Soft ripened cheese, 125 g', 14.00, 30, 6, 30],
    ['Gouda Slices 200 g', 'Mild Gouda cheese slices, 200 g', 10.50, 55, 10, 60],
    ['Emmental Slices 150 g', 'Swiss-style Emmental slices, 150 g', 11.00, 50, 10, 60],
    ['Spreadable Labneh 400 g', 'Ready-to-use labneh in tub, 400 g', 7.50, 80, 15, 21],
    ['Double Cream 200 g', 'Extra-rich cream, 200 g', 6.75, 55, 10, 14],
    ['Laban Soup Base 500 ml', 'Ready-to-cook yoghurt base, 500 ml', 5.25, 45, 8, 7],
    ['Cheese Spread Triangles ×8', 'Processed cheese spread portions, 120 g', 6.50, 100, 18, 90],
    ['Tzatziki Dip 200 g', 'Yoghurt cucumber dip, 200 g', 6.00, 55, 10, 14],
    ['Greek Yoghurt 200 g', 'Thick strained Greek yoghurt, 200 g', 5.50, 80, 15, 21],
    ['Caciotta Cheese 300 g', 'Italian-style soft cheese, 300 g', 12.50, 40, 8, 30],
  ],

  Bakery: [
    ['Kaak Assal 300 g', 'Sesame & anise ring cookies, 300 g', 4.50, 110, 20, 60],
    ['Maamoul Date ×6', 'Semolina date-filled cookies ×6, 300 g', 9.00, 85, 15, 45],
    ['Maamoul Walnut ×6', 'Semolina walnut-filled cookies ×6, 300 g', 10.00, 80, 15, 45],
    ['Maamoul Pistachio ×6', 'Semolina pistachio-filled cookies ×6, 300 g', 12.00, 70, 12, 45],
    ['Kaak Banadoura 250 g', 'Tomato-spiced ring crackers, 250 g', 5.50, 90, 15, 60],
    ['Zaatar Bread Sticks 200 g', 'Thyme-olive oil breadsticks, 200 g', 4.75, 100, 18, 30],
    ['Sambousek Pastry Discs 500 g', 'Ready-to-fill pastry discs, 500 g', 6.00, 70, 12, 14],
    ['Pita Bread ×6', 'Traditional pita bread rounds, 480 g', 2.75, 200, 35, 7],
    ['Saj Bread ×4', 'Thin flatbread sheets, 400 g', 3.25, 170, 30, 5],
    ['Markouk Bread', 'Extra-thin mountain flatbread, 300 g', 3.00, 150, 25, 5],
    ['Croissant Plain', 'Butter croissant, 80 g', 2.50, 120, 25, 3],
    ['Croissant Zaatar', 'Thyme-filled croissant, 90 g', 3.00, 100, 20, 3],
    ['Pain au Chocolat', 'Chocolate-filled pastry, 90 g', 3.25, 90, 18, 3],
    ['Kaak Mabroushe 300 g', 'Spiced ring bread, 300 g', 5.00, 85, 15, 30],
    ['Ghraybeh Cookies 250 g', 'Butter shortbread cookies ×10, 250 g', 6.50, 75, 12, 60],
    ['Barazek Cookies 200 g', 'Sesame pistachio crisps, 200 g', 8.00, 65, 10, 60],
    ['Awamat Dough Mix 300 g', 'Ready-to-fry doughnut balls mix, 300 g', 4.25, 60, 10, 30],
    ['Brioche Loaf 400 g', 'Enriched milk bread loaf, 400 g', 6.75, 70, 12, 7],
    ['Sandwich Bread Loaf 500 g', 'Sliced white sandwich bread, 500 g', 3.50, 160, 30, 7],
    ['Whole-Wheat Loaf 500 g', 'Sliced whole-wheat bread, 500 g', 4.00, 130, 22, 7],
    ['Sourdough Loaf 600 g', 'Artisan sourdough loaf, 600 g', 9.50, 40, 8, 5],
    ['Multigrain Bread 500 g', 'Sliced multigrain loaf, 500 g', 4.50, 110, 20, 7],
    ['Baguette 250 g', 'French-style baguette, 250 g', 3.25, 90, 15, 2],
    ['Sesame Baguette 260 g', 'Seeded French baguette, 260 g', 3.75, 80, 15, 2],
    ['Manaqeesh Zaatar 200 g', 'Ready-baked zaatar flatbread, 200 g', 4.00, 100, 18, 3],
    ['Manaqeesh Jibneh 220 g', 'Cheese flatbread, 220 g', 4.50, 90, 15, 3],
    ['Fatayer Spinach ×4', 'Baked spinach pastry pockets, 320 g', 7.00, 60, 10, 3],
    ['Fatayer Cheese ×4', 'Baked cheese pastry pockets, 320 g', 7.50, 55, 10, 3],
    ['Baklava Assorted 250 g', 'Mixed nut-honey pastry pieces, 250 g', 14.00, 50, 8, 30],
    ['Knafeh Nabulsieh Mix 500 g', 'Ready-mix semolina pastry, 500 g', 8.00, 55, 10, 90],
    ['Namoura 300 g', 'Syrup-soaked semolina squares, 300 g', 6.50, 65, 10, 30],
    ['Pistachio Finger Pastry ×8', 'Crispy rolled pistachio pastry ×8, 200 g', 12.00, 45, 8, 30],
    ['Lemon Pound Cake 400 g', 'Glazed lemon pound cake, 400 g', 8.75, 55, 10, 14],
    ['Chocolate Marble Cake 400 g', 'Chocolate marble cake, 400 g', 9.25, 50, 10, 14],
    ['Blueberry Muffins ×4', 'Blueberry muffins, 280 g', 7.00, 70, 12, 7],
    ['Chocolate Muffins ×4', 'Double-chocolate muffins, 280 g', 7.25, 65, 12, 7],
    ['Glazed Donuts ×4', 'Classic glazed ring doughnuts, 240 g', 6.00, 80, 15, 3],
    ['Chocolate Donuts ×4', 'Chocolate-frosted doughnuts, 240 g', 6.50, 75, 15, 3],
    ['Rusk Bread 300 g', 'Twice-baked crunchy bread slices, 300 g', 4.75, 90, 15, 180],
    ['Breadcrumbs 400 g', 'Fine golden breadcrumbs, 400 g', 3.50, 100, 18, 365],
    ['Sesame Crackers 200 g', 'Crispy sesame water crackers, 200 g', 4.00, 85, 15, 180],
    ['Whole-Wheat Crackers 200 g', 'Whole-wheat crackers, 200 g', 4.25, 80, 15, 180],
    ['Cornbread Mix 500 g', 'Sweet cornbread baking mix, 500 g', 5.50, 55, 10, 365],
    ['Pancake Mix 500 g', 'Ready-mix fluffy pancakes, 500 g', 5.25, 60, 10, 365],
    ['Waffle Mix 400 g', 'Crispy waffle baking mix, 400 g', 5.75, 50, 8, 365],
    ['Pita Chips Original 150 g', 'Baked pita crisps, 150 g', 3.75, 120, 22, 90],
    ['Pita Chips Zaatar 150 g', 'Thyme pita crisps, 150 g', 4.00, 110, 20, 90],
    ['Ladyfinger Biscuits 200 g', 'Sponge finger biscuits, 200 g', 5.00, 80, 15, 120],
    ['Digestive Biscuits 400 g', 'Whole-wheat digestive biscuits, 400 g', 4.50, 95, 18, 180],
    ['Petit Beurre 200 g', 'Classic butter biscuits, 200 g', 3.75, 100, 18, 180],
    ['Kaak Soda 300 g', 'Baking-soda ring crackers, 300 g', 4.25, 85, 15, 90],
  ],

  Produce: [
    ['Tomatoes 1 kg', 'Fresh ripe Lebanese tomatoes, 1 kg', 2.50, 180, 30, 7],
    ['Cucumbers 1 kg', 'Fresh Lebanese mini cucumbers, 1 kg', 2.00, 160, 28, 7],
    ['Parsley Bunch', 'Fresh flat-leaf parsley, ~200 g', 1.25, 120, 25, 5],
    ['Mint Bunch', 'Fresh garden mint, ~150 g', 1.00, 110, 20, 5],
    ['Fresh Zaatar Bunch', 'Fresh thyme herb bundle, ~100 g', 1.50, 90, 18, 5],
    ['Lemons 1 kg', 'Sour Lebanese lemons, 1 kg', 2.75, 150, 25, 14],
    ['Garlic 500 g', 'Fresh garlic heads, 500 g', 3.50, 100, 18, 30],
    ['Onions 1 kg', 'Yellow onions, 1 kg', 1.75, 200, 35, 30],
    ['Spring Onions Bunch', 'Fresh green onions, ~200 g', 1.25, 90, 18, 5],
    ['Eggplant 1 kg', 'Dark purple Lebanese eggplant, 1 kg', 2.25, 130, 22, 7],
    ['Zucchini 1 kg', 'Light-green Lebanese zucchini, 1 kg', 2.50, 140, 25, 7],
    ['Potatoes 1 kg', 'Yellow Lebanese potatoes, 1 kg', 1.50, 220, 40, 30],
    ['Sweet Potato 1 kg', 'Orange-flesh sweet potato, 1 kg', 3.00, 100, 18, 30],
    ['Carrots 1 kg', 'Orange carrots, 1 kg', 1.75, 170, 30, 14],
    ['Beets 1 kg', 'Fresh red beets, 1 kg', 2.00, 90, 15, 14],
    ['Spinach Bunch', 'Baby spinach leaves, ~300 g', 2.50, 80, 15, 4],
    ['Iceberg Lettuce', 'Iceberg lettuce head, ~500 g', 2.25, 110, 20, 5],
    ['Romaine Lettuce', 'Cos lettuce head, ~400 g', 2.50, 100, 18, 5],
    ['White Cabbage', 'White cabbage head, ~1 kg', 2.00, 90, 15, 14],
    ['Red Cabbage 500 g', 'Shredded red cabbage, 500 g', 2.75, 70, 12, 14],
    ['Broccoli', 'Green broccoli crown, ~500 g', 3.50, 70, 12, 7],
    ['Cauliflower', 'White cauliflower head, ~800 g', 3.25, 75, 12, 7],
    ['Red Bell Pepper 500 g', 'Red sweet peppers, 500 g', 3.00, 90, 15, 7],
    ['Green Bell Pepper 500 g', 'Green sweet peppers, 500 g', 2.50, 95, 18, 7],
    ['Hot Green Chili 200 g', 'Fresh hot green chili peppers, 200 g', 1.75, 80, 15, 7],
    ['Cracked Green Olives 250 g', 'Marinated cracked green olives, 250 g', 4.50, 85, 15, 90],
    ['Black Olives 250 g', 'Pitted black olives in brine, 250 g', 4.75, 80, 15, 90],
    ['Globe Artichokes ×4', 'Fresh globe artichokes, ×4', 8.00, 50, 8, 7],
    ['White Mushrooms 250 g', 'Button mushrooms, 250 g', 3.50, 75, 12, 5],
    ['Okra 500 g', 'Fresh bamiyeh pods, 500 g', 3.00, 65, 10, 5],
    ['Green Beans 500 g', 'Fresh runner beans, 500 g', 2.50, 80, 15, 5],
    ['Broad Beans 500 g', 'Fresh ful akhdar pods, 500 g', 2.75, 70, 12, 5],
    ['Peas 500 g', 'Fresh shelled green peas, 500 g', 2.50, 75, 12, 5],
    ['Sweet Corn ×2', 'Sweet corn cobs, pair', 2.25, 90, 15, 5],
    ['Red Apples 1 kg', 'Fresh red apples, 1 kg', 3.75, 150, 25, 14],
    ['Green Apples 1 kg', 'Granny Smith apples, 1 kg', 3.50, 130, 22, 14],
    ['Bananas 1 kg', 'Ripe yellow bananas, 1 kg', 2.50, 160, 28, 7],
    ['Oranges 1 kg', 'Juicing oranges, 1 kg', 3.00, 140, 25, 14],
    ['Mandarins 1 kg', 'Seedless clementines, 1 kg', 4.00, 110, 20, 14],
    ['White Grapes 500 g', 'Seedless white grapes, 500 g', 4.50, 90, 15, 7],
    ['Watermelon Quarter', 'Seedless watermelon quarter, ~2 kg', 3.50, 60, 10, 5],
    ['Honeydew Melon Half', 'Honeydew melon half, ~1.5 kg', 4.00, 50, 8, 5],
    ['Strawberries 250 g', 'Fresh strawberries, 250 g', 4.50, 80, 15, 4],
    ['Fresh Figs 500 g', 'Fresh black figs, 500 g', 6.00, 45, 8, 5],
    ['Pomegranates ×2', 'Ripe red pomegranates, pair', 5.50, 55, 10, 14],
    ['Pears 1 kg', 'Ripe juicy pears, 1 kg', 4.25, 100, 18, 14],
    ['Red Plums 500 g', 'Sweet red plums, 500 g', 4.00, 70, 12, 7],
    ['Peaches 500 g', 'Ripe yellow peaches, 500 g', 4.50, 65, 10, 7],
    ['Lebanese Apricots 500 g', 'Fresh Lebanese apricots, 500 g', 5.00, 60, 10, 5],
    ['Loquats 300 g', 'Fresh akidinia loquats, 300 g', 5.50, 40, 8, 4],
    ['Cherry Tomatoes 250 g', 'Sweet cherry tomatoes, 250 g', 3.25, 100, 18, 7],
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
  ],

  Beverages: [
    ['Arak Fakra 750 ml', 'Premium Lebanese anise spirit, 750 ml', 28.00, 60, 10, null],
    ['Arak Touma 500 ml', 'Classic Lebanese arak, 500 ml', 18.00, 75, 12, null],
    ['Ksara Blanc de Blancs 750 ml', 'Dry white wine, 750 ml', 22.00, 50, 8, null],
    ['Ksara Cuvée Millénaire 750 ml', 'Premium red wine, 750 ml', 32.00, 40, 6, null],
    ['Château Musar Red 750 ml', 'Iconic Lebanese red wine, 750 ml', 65.00, 25, 5, null],
    ['Château Musar White 750 ml', 'Iconic Lebanese white wine, 750 ml', 60.00, 20, 4, null],
    ['Almaza Beer 330 ml', 'Lebanese pilsner lager can, 330 ml', 3.50, 200, 36, 180],
    ['Almaza Beer 500 ml', 'Lebanese pilsner lager bottle, 500 ml', 4.75, 160, 28, 180],
    ['Gold Beer 330 ml', 'Light Lebanese lager can, 330 ml', 3.25, 180, 32, 180],
    ['Laziza Malt 330 ml', 'Non-alcoholic malt beverage, 330 ml', 2.75, 150, 25, 180],
    ['Laziza Strawberry 330 ml', 'Strawberry malt drink, 330 ml', 2.75, 140, 25, 180],
    ['Laziza Lemon 330 ml', 'Lemon malt drink, 330 ml', 2.75, 130, 22, 180],
    ['Fresh Orange Juice 1 L', 'Chilled squeezed orange juice, 1 L', 6.50, 90, 15, 5],
    ['Fresh Carrot Juice 500 ml', 'Cold-pressed carrot juice, 500 ml', 5.50, 70, 12, 4],
    ['Fresh Pomegranate Juice 500 ml', 'Cold-pressed pomegranate juice, 500 ml', 8.00, 55, 10, 4],
    ['Jallab Juice 500 ml', 'Rose water & grape cordial, 500 ml', 4.50, 80, 15, 180],
    ['Tamarind Drink 500 ml', 'Tamer hindi cold drink, 500 ml', 4.25, 75, 12, 90],
    ['Rose Water Cordial 600 ml', 'Maward concentrate syrup, 600 ml', 5.00, 65, 10, 365],
    ['Orange Blossom Water 250 ml', 'Mazaher flavouring water, 250 ml', 3.75, 80, 15, 365],
    ['Sparkling Lemonade 330 ml', 'Lebanese sparkling lemonade, 330 ml', 2.25, 200, 36, 180],
    ['Mint Lemonade 330 ml', 'Mint-lemon sparkling drink, 330 ml', 2.25, 190, 32, 180],
    ['Pepsi 330 ml', 'Cola carbonated drink, 330 ml', 1.75, 250, 45, 180],
    ['Pepsi 1.5 L', 'Cola carbonated drink, 1.5 L', 3.25, 200, 35, 180],
    ['7UP 330 ml', 'Lemon-lime soda, 330 ml', 1.75, 230, 40, 180],
    ['7UP 1.5 L', 'Lemon-lime soda, 1.5 L', 3.25, 190, 32, 180],
    ['Mirinda Orange 330 ml', 'Orange carbonated drink, 330 ml', 1.75, 210, 36, 180],
    ['Mirinda Strawberry 330 ml', 'Strawberry soda, 330 ml', 1.75, 200, 35, 180],
    ['Sprite 330 ml', 'Clear lemon-lime soda, 330 ml', 1.75, 220, 38, 180],
    ['Mountain Dew 330 ml', 'Citrus energy soda, 330 ml', 1.75, 180, 30, 180],
    ['Red Bull 250 ml', 'Energy drink can, 250 ml', 5.50, 120, 22, 730],
    ['Monster Energy 500 ml', 'Energy drink can, 500 ml', 7.00, 100, 18, 730],
    ['Nescafé Classic 200 g', 'Instant coffee jar, 200 g', 12.00, 80, 15, 730],
    ['Nescafé 3-in-1 ×20', 'Instant white coffee sachets, ×20', 8.50, 90, 15, 730],
    ['Najjar Coffee 200 g', 'Ground Lebanese Turkish coffee, 200 g', 9.00, 75, 12, 365],
    ['Najjar Cardamom Coffee 200 g', 'Cardamom-blend ground coffee, 200 g', 9.50, 65, 10, 365],
    ['Filter Coffee 250 g', 'Medium roast filter grind, 250 g', 10.00, 55, 10, 365],
    ['Earl Grey Tea ×25', 'Bergamot black tea bags, ×25', 5.50, 90, 15, 730],
    ['Green Tea ×25', 'Pure green tea bags, ×25', 5.00, 85, 15, 730],
    ['Chamomile Tea ×25', 'Dried chamomile flower tea, ×25', 5.25, 80, 15, 730],
    ['Sage Tea ×20', 'Maryamiyeh sage tea bags, ×20', 4.75, 70, 12, 730],
    ['Anise Seeds 100 g', 'Dried anise seeds, 100 g', 3.50, 75, 12, 730],
    ['Mineral Water 500 ml', 'Sohat still mineral water, 500 ml', 1.25, 350, 60, 730],
    ['Mineral Water 1.5 L', 'Sohat still mineral water, 1.5 L', 1.75, 280, 50, 730],
    ['Sparkling Water 500 ml', 'Fizzy mineral water, 500 ml', 1.75, 200, 35, 730],
    ['Coconut Water 330 ml', 'Natural coconut water can, 330 ml', 4.50, 90, 15, 180],
    ['Mango Nectar 1 L', 'Tropical mango juice drink, 1 L', 4.25, 110, 20, 180],
    ['Peach Nectar 1 L', 'Peach juice drink, 1 L', 4.25, 100, 18, 180],
    ['Apricot Nectar 1 L', 'Apricot juice drink, 1 L', 4.50, 95, 18, 180],
    ['Mixed Fruits Juice 1 L', 'Multi-fruit juice blend, 1 L', 4.00, 120, 22, 90],
    ['Ayran Salted 330 ml', 'Cold salty yoghurt drink, 330 ml', 2.50, 130, 22, 14],
    ['Tannourine Water 500 ml', 'Tannourine natural mineral water, 500 ml', 1.50, 300, 55, 730],
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
  ],
};

// Wipe + re-seed: truncate all domain tables, then insert categories, users,
// products + inventory rows, and a small demo sale to exercise the schema.
async function main() {
  if (!process.env.DATABASE_URL) {
    logger.error('DATABASE_URL is required. Configure backend/.env first.');
    process.exitCode = 1;
    return;
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    logger.info('Resetting tables…');
    await client.query(
      'TRUNCATE sale_items, sales, alerts, inventory, products, users, categories RESTART IDENTITY CASCADE'
    );

    // ── Categories ──────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO categories (name) VALUES ('Dairy'), ('Bakery'), ('Produce'), ('Beverages')
    `);
    const { rows: cats } = await client.query('SELECT id, name FROM categories ORDER BY id');
    const cat = Object.fromEntries(cats.map((c) => [c.name, c.id]));
    logger.info('Categories ✓');

    // ── Users ────────────────────────────────────────────────────────────────
    const [adminHash, staffHash] = await Promise.all([
      bcrypt.hash('Admin@1234', 10),
      bcrypt.hash('Staff@1234', 10),
    ]);
    await client.query(
      `INSERT INTO users (name, email, password, role) VALUES
         ('Admin User', 'admin@warehouse.com', $1, 'admin'),
         ('Staff User', 'staff@warehouse.com', $2, 'staff')`,
      [adminHash, staffHash]
    );
    logger.info('Users ✓');

    // ── Products & Inventory ─────────────────────────────────────────────────
    let totalInserted = 0;
    for (const [catName, items] of Object.entries(PRODUCTS)) {
      const catId = cat[catName];
      for (const [name, description, price, quantity, threshold, expiryDays] of items) {
        const { rows: [p] } = await client.query(
          `INSERT INTO products (name, description, category_id, price)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [name, description, catId, price]
        );
        const expiryDate = expiryDays !== null ? addDays(expiryDays) : null;
        await client.query(
          `INSERT INTO inventory (product_id, quantity, threshold, expiry_date)
           VALUES ($1, $2, $3, $4)`,
          [p.id, quantity, threshold, expiryDate]
        );
        totalInserted++;
      }
      logger.info(`  ${catName}: ${items.length} products ✓`);
    }
    logger.info(`Products & Inventory: ${totalInserted} total ✓`);

    // ── Demo sale ────────────────────────────────────────────────────────────
    const { rows: [staff] } = await client.query(
      `SELECT id FROM users WHERE role = 'staff' LIMIT 1`
    );
    // Pick first two products for the demo sale
    const { rows: demoProds } = await client.query(
      `SELECT p.id, i.quantity, p.price FROM products p
       JOIN inventory i ON i.product_id = p.id
       WHERE i.quantity >= 2
       ORDER BY p.id LIMIT 2`
    );
    if (demoProds.length === 2) {
      const total = (demoProds[0].price * 2 + demoProds[1].price * 1).toFixed(2);
      const { rows: [sale] } = await client.query(
        `INSERT INTO sales (user_id, total_amount, notes) VALUES ($1, $2, 'Demo sale') RETURNING id`,
        [staff.id, total]
      );
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, price_at_sale) VALUES
           ($1, $2, 2, $3),
           ($1, $4, 1, $5)`,
        [sale.id, demoProds[0].id, demoProds[0].price, demoProds[1].id, demoProds[1].price]
      );
      // Deduct stock
      await client.query('UPDATE inventory SET quantity = quantity - 2 WHERE product_id = $1', [demoProds[0].id]);
      await client.query('UPDATE inventory SET quantity = quantity - 1 WHERE product_id = $1', [demoProds[1].id]);
      logger.info('Demo sale ✓');
    }

    logger.info('');
    logger.info('Seed complete.');
    logger.info('  Admin: admin@warehouse.com / Admin@1234');
    logger.info('  Staff: staff@warehouse.com / Staff@1234');
    logger.info(`  Total products: ${totalInserted}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  logger.error(`Seed failed: ${err.message}`);
  process.exitCode = 1;
});
