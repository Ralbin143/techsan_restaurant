/**
 * Adds menu items to the first restaurant without wiping existing data.
 * Skips items that already exist (matched by name).
 *
 * Usage: npm run seed:menu
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Restaurant } from "../models/Restaurant.js";
import { Category } from "../models/Category.js";
import { MenuItem } from "../models/MenuItem.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const MENU_ITEMS = [
  // Starters
  { category: "Starters", name: "Paneer Tikka", description: "Char-grilled cottage cheese with mint chutney", basePrice: 249, isVeg: true, preparationTime: 15 },
  { category: "Starters", name: "Chicken Wings", description: "Crispy wings tossed in spicy sauce", basePrice: 299, isVeg: false, preparationTime: 20 },
  { category: "Starters", name: "Veg Spring Rolls", description: "Crispy rolls with mixed vegetables", basePrice: 179, isVeg: true, preparationTime: 12 },
  { category: "Starters", name: "Fish Amritsari", description: "Batter-fried fish with ajwain spices", basePrice: 349, isVeg: false, preparationTime: 18 },
  // Main course
  { category: "Main Course", name: "Butter Chicken", description: "Creamy tomato gravy with tender chicken", basePrice: 399, isVeg: false, preparationTime: 25 },
  { category: "Main Course", name: "Dal Makhani", description: "Slow-cooked black lentils with cream", basePrice: 279, isVeg: true, preparationTime: 20 },
  { category: "Main Course", name: "Paneer Butter Masala", description: "Paneer cubes in rich buttery gravy", basePrice: 329, isVeg: true, preparationTime: 22 },
  { category: "Main Course", name: "Chicken Biryani", description: "Fragrant basmati rice with spiced chicken", basePrice: 349, isVeg: false, preparationTime: 30 },
  { category: "Main Course", name: "Veg Pulao", description: "Aromatic rice with seasonal vegetables", basePrice: 249, isVeg: true, preparationTime: 18 },
  // Breads & rice
  { category: "Breads & Rice", name: "Butter Naan", description: "Soft leavened bread with butter", basePrice: 59, isVeg: true, preparationTime: 8 },
  { category: "Breads & Rice", name: "Garlic Naan", description: "Naan topped with garlic and coriander", basePrice: 69, isVeg: true, preparationTime: 8 },
  { category: "Breads & Rice", name: "Steamed Rice", description: "Plain basmati rice", basePrice: 149, isVeg: true, preparationTime: 12 },
  // Desserts
  { category: "Desserts", name: "Gulab Jamun", description: "Warm milk dumplings in sugar syrup", basePrice: 129, isVeg: true, preparationTime: 5 },
  { category: "Desserts", name: "Ice Cream Scoop", description: "Choice of vanilla or chocolate", basePrice: 99, isVeg: true, preparationTime: 3 },
  // Beverages
  { category: "Beverages", name: "Fresh Lime Soda", description: "Sweet or salted", basePrice: 89, isVeg: true, preparationTime: 5 },
];

async function getOrCreateCategory(restaurantId, name, sortOrder) {
  let cat = await Category.findOne({ restaurantId, name, isActive: true });
  if (!cat) {
    cat = await Category.create({ restaurantId, name, sortOrder, isActive: true });
    console.log(`  + Category: ${name}`);
  }
  return cat;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not set");
    process.exit(1);
  }

  await mongoose.connect(uri);

  const restaurant = await Restaurant.findOne({ isActive: true }).sort({ createdAt: 1 });
  if (!restaurant) {
    console.error("No restaurant found. Run npm run seed first.");
    process.exit(1);
  }

  console.log(`Restaurant: ${restaurant.name} (${restaurant._id})`);

  const categoryOrder = ["Starters", "Main Course", "Breads & Rice", "Desserts", "Beverages"];
  const categoryMap = {};
  for (let i = 0; i < categoryOrder.length; i++) {
    categoryMap[categoryOrder[i]] = await getOrCreateCategory(
      restaurant._id,
      categoryOrder[i],
      i + 1
    );
  }

  let created = 0;
  let skipped = 0;

  for (const item of MENU_ITEMS) {
    const exists = await MenuItem.findOne({
      restaurantId: restaurant._id,
      name: item.name,
      isDeleted: false,
    });
    if (exists) {
      skipped++;
      continue;
    }

    const categoryId = categoryMap[item.category]._id;
    await MenuItem.create({
      restaurantId: restaurant._id,
      categoryId,
      name: item.name,
      description: item.description,
      basePrice: item.basePrice,
      isVeg: item.isVeg,
      isAvailable: true,
      preparationTime: item.preparationTime,
    });
    created++;
    console.log(`  + ${item.name} (₹${item.basePrice}) → ${item.category}`);
  }

  const total = await MenuItem.countDocuments({
    restaurantId: restaurant._id,
    isDeleted: false,
  });

  console.log(`\nDone: ${created} added, ${skipped} already existed. Total menu items: ${total}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
