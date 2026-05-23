import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { User } from "../models/User.js";
import { Restaurant } from "../models/Restaurant.js";
import { Branch } from "../models/Branch.js";
import { Category } from "../models/Category.js";
import { MenuItem } from "../models/MenuItem.js";
import { DiningArea } from "../models/DiningArea.js";
import { Table } from "../models/Table.js";
import { Tax } from "../models/Tax.js";
import { Inventory } from "../models/Inventory.js";
import { Supplier } from "../models/Supplier.js";
import { PurchaseOrder } from "../models/PurchaseOrder.js";
import { Expense } from "../models/Expense.js";
import { Employee } from "../models/Employee.js";
import { ROLES } from "../constants/roles.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not set. Copy .env.example to .env at repo root.");
    process.exit(1);
  }
  console.log("Connecting to", uri);
  await mongoose.connect(uri);

  // Drop legacy indexes that conflict on null phone/email values
  try {
    await User.collection.dropIndexes();
  } catch {
    // collection may not exist yet
  }

  await Promise.all([
    User.deleteMany({}),
    Restaurant.deleteMany({}),
    Branch.deleteMany({}),
    Category.deleteMany({}),
    MenuItem.deleteMany({}),
    DiningArea.deleteMany({}),
    Table.deleteMany({}),
    Tax.deleteMany({}),
    Inventory.deleteMany({}),
    Supplier.deleteMany({}),
    PurchaseOrder.deleteMany({}),
    Expense.deleteMany({}),
    Employee.deleteMany({}),
  ]);

  const restaurant = await Restaurant.create({
    name: "TechSan Bistro",
    slug: "techsan-bistro",
    email: "admin@techsan.com",
    currency: "INR",
  });

  const branch = await Branch.create({
    restaurantId: restaurant._id,
    name: "Main Branch",
    code: "MAIN",
    address: { city: "Mumbai", country: "India" },
  });

  const admin = await User.create({
    email: "admin@techsan.com",
    password: "Admin@123",
    firstName: "Super",
    lastName: "Admin",
    role: ROLES.SUPER_ADMIN,
    restaurantId: restaurant._id,
    isEmailVerified: true,
  });

  restaurant.ownerId = admin._id;
  await restaurant.save();

  const employeeSeed = [
    {
      email: "waiter@techsan.com",
      password: "Waiter@123",
      firstName: "John",
      lastName: "Mathew",
      role: ROLES.WAITER,
      employeeCode: "EMP-001",
      designation: "Senior Waiter",
      department: "Front of House",
      joinDate: "2024-01-15",
      salaryBase: 18000,
    },
    {
      email: "kitchen@techsan.com",
      password: "Kitchen@123",
      firstName: "Rajesh",
      lastName: "Kumar",
      role: ROLES.KITCHEN,
      employeeCode: "EMP-002",
      designation: "Head Chef",
      department: "Kitchen",
      joinDate: "2023-06-01",
      salaryBase: 35000,
    },
    {
      email: "cashier@techsan.com",
      password: "Cashier@123",
      firstName: "Jane",
      lastName: "Dsouza",
      role: ROLES.CASHIER,
      employeeCode: "EMP-003",
      designation: "Cashier",
      department: "Front of House",
      joinDate: "2024-03-10",
      salaryBase: 20000,
    },
    {
      email: "priya.waiter@techsan.com",
      password: "Staff@123",
      firstName: "Priya",
      lastName: "Sharma",
      role: ROLES.WAITER,
      employeeCode: "EMP-004",
      designation: "Waiter",
      department: "Front of House",
      joinDate: "2024-05-20",
      salaryBase: 16500,
    },
    {
      email: "rahul.waiter@techsan.com",
      password: "Staff@123",
      firstName: "Rahul",
      lastName: "Mehta",
      role: ROLES.WAITER,
      employeeCode: "EMP-005",
      designation: "Waiter",
      department: "Front of House",
      joinDate: "2024-08-01",
      salaryBase: 16000,
    },
    {
      email: "anita.kitchen@techsan.com",
      password: "Staff@123",
      firstName: "Anita",
      lastName: "Desai",
      role: ROLES.KITCHEN,
      employeeCode: "EMP-006",
      designation: "Sous Chef",
      department: "Kitchen",
      joinDate: "2023-11-12",
      salaryBase: 28000,
    },
    {
      email: "vikram.kitchen@techsan.com",
      password: "Staff@123",
      firstName: "Vikram",
      lastName: "Singh",
      role: ROLES.KITCHEN,
      employeeCode: "EMP-007",
      designation: "Line Cook",
      department: "Kitchen",
      joinDate: "2024-02-18",
      salaryBase: 22000,
    },
    {
      email: "meera.cashier@techsan.com",
      password: "Staff@123",
      firstName: "Meera",
      lastName: "Patel",
      role: ROLES.CASHIER,
      employeeCode: "EMP-008",
      designation: "Cashier",
      department: "Front of House",
      joinDate: "2024-06-05",
      salaryBase: 19500,
    },
    {
      email: "manager@techsan.com",
      password: "Manager@123",
      firstName: "Arjun",
      lastName: "Nair",
      role: ROLES.MANAGER,
      employeeCode: "EMP-009",
      designation: "Floor Manager",
      department: "Management",
      joinDate: "2022-09-01",
      salaryBase: 42000,
    },
    {
      email: "sofia.kitchen@techsan.com",
      password: "Staff@123",
      firstName: "Sofia",
      lastName: "Khan",
      role: ROLES.KITCHEN,
      employeeCode: "EMP-010",
      designation: "Pastry Chef",
      department: "Kitchen",
      joinDate: "2024-04-22",
      salaryBase: 24000,
    },
  ];

  const staffUsers = await User.create(
    employeeSeed.map(({ email, password, firstName, lastName, role }) => ({
      email,
      password,
      firstName,
      lastName,
      role,
      restaurantId: restaurant._id,
      branchId: branch._id,
      isEmailVerified: true,
    }))
  );

  await Employee.insertMany(
    employeeSeed.map((emp, i) => ({
      userId: staffUsers[i]._id,
      branchId: branch._id,
      employeeCode: emp.employeeCode,
      designation: emp.designation,
      department: emp.department,
      joinDate: new Date(emp.joinDate),
      salary: { base: emp.salaryBase, type: "monthly" },
    }))
  );

  await Tax.create({ restaurantId: restaurant._id, name: "GST", rate: 5, type: "gst" });

  const categories = await Category.insertMany([
    { restaurantId: restaurant._id, name: "Starters", sortOrder: 1 },
    { restaurantId: restaurant._id, name: "Main Course", sortOrder: 2 },
    { restaurantId: restaurant._id, name: "Breads & Rice", sortOrder: 3 },
    { restaurantId: restaurant._id, name: "Desserts", sortOrder: 4 },
    { restaurantId: restaurant._id, name: "Beverages", sortOrder: 5 },
  ]);

  const cat = Object.fromEntries(categories.map((c) => [c.name, c._id]));

  /* Menu photos: stable Unsplash URLs (food-themed) for QR guest menu */
  const menuPhotos = {
    paneerTikka:
      "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&h=600&fit=crop&q=80",
    chickenWings:
      "https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=600&h=600&fit=crop&q=80",
    springRolls:
      "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=600&h=600&fit=crop&q=80",
    fish:
      "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&h=600&fit=crop&q=80",
    butterChicken:
      "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=600&h=600&fit=crop&q=80",
    dal:
      "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&h=600&fit=crop&q=80",
    paneerMasala:
      "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&h=600&fit=crop&q=80",
    biryani:
      "https://images.unsplash.com/photo-1563379091339-03246963d4b9?w=600&h=600&fit=crop&q=80",
    pulao:
      "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&h=600&fit=crop&q=80",
    naan:
      "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&h=600&fit=crop&q=80",
    garlicNaan:
      "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=600&h=600&fit=crop&q=80",
    rice:
      "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&h=600&fit=crop&q=80",
    gulab:
      "https://images.unsplash.com/photo-1590080875510-405ce0fc2c9d?w=600&h=600&fit=crop&q=80",
    iceCream:
      "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&h=600&fit=crop&q=80",
    lime:
      "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&h=600&fit=crop&q=80",
  };

  await MenuItem.insertMany([
    {
      restaurantId: restaurant._id,
      categoryId: cat["Starters"],
      name: "Paneer Tikka",
      description: "Char-grilled cottage cheese with mint chutney",
      image: menuPhotos.paneerTikka,
      basePrice: 249,
      isVeg: true,
      preparationTime: 15,
    },
    {
      restaurantId: restaurant._id,
      categoryId: cat["Starters"],
      name: "Chicken Wings",
      description: "Crispy wings tossed in spicy sauce",
      image: menuPhotos.chickenWings,
      basePrice: 299,
      isVeg: false,
      preparationTime: 20,
    },
    {
      restaurantId: restaurant._id,
      categoryId: cat["Starters"],
      name: "Veg Spring Rolls",
      description: "Crispy rolls with mixed vegetables",
      image: menuPhotos.springRolls,
      basePrice: 179,
      isVeg: true,
      preparationTime: 12,
    },
    {
      restaurantId: restaurant._id,
      categoryId: cat["Starters"],
      name: "Fish Amritsari",
      description: "Batter-fried fish with ajwain spices",
      image: menuPhotos.fish,
      basePrice: 349,
      isVeg: false,
      preparationTime: 18,
    },
    {
      restaurantId: restaurant._id,
      categoryId: cat["Main Course"],
      name: "Butter Chicken",
      description: "Creamy tomato gravy with tender chicken",
      image: menuPhotos.butterChicken,
      basePrice: 399,
      isVeg: false,
      preparationTime: 25,
    },
    {
      restaurantId: restaurant._id,
      categoryId: cat["Main Course"],
      name: "Dal Makhani",
      description: "Slow-cooked black lentils with cream",
      image: menuPhotos.dal,
      basePrice: 279,
      isVeg: true,
      preparationTime: 20,
    },
    {
      restaurantId: restaurant._id,
      categoryId: cat["Main Course"],
      name: "Paneer Butter Masala",
      description: "Paneer cubes in rich buttery gravy",
      image: menuPhotos.paneerMasala,
      basePrice: 329,
      isVeg: true,
      preparationTime: 22,
    },
    {
      restaurantId: restaurant._id,
      categoryId: cat["Main Course"],
      name: "Chicken Biryani",
      description: "Fragrant basmati rice with spiced chicken",
      image: menuPhotos.biryani,
      basePrice: 349,
      isVeg: false,
      preparationTime: 30,
    },
    {
      restaurantId: restaurant._id,
      categoryId: cat["Main Course"],
      name: "Veg Pulao",
      description: "Aromatic rice with seasonal vegetables",
      image: menuPhotos.pulao,
      basePrice: 249,
      isVeg: true,
      preparationTime: 18,
    },
    {
      restaurantId: restaurant._id,
      categoryId: cat["Breads & Rice"],
      name: "Butter Naan",
      description: "Soft leavened bread with butter",
      image: menuPhotos.naan,
      basePrice: 59,
      isVeg: true,
      preparationTime: 8,
    },
    {
      restaurantId: restaurant._id,
      categoryId: cat["Breads & Rice"],
      name: "Garlic Naan",
      description: "Naan topped with garlic and coriander",
      image: menuPhotos.garlicNaan,
      basePrice: 69,
      isVeg: true,
      preparationTime: 8,
    },
    {
      restaurantId: restaurant._id,
      categoryId: cat["Breads & Rice"],
      name: "Steamed Rice",
      description: "Plain basmati rice",
      image: menuPhotos.rice,
      basePrice: 149,
      isVeg: true,
      preparationTime: 12,
    },
    {
      restaurantId: restaurant._id,
      categoryId: cat["Desserts"],
      name: "Gulab Jamun",
      description: "Warm milk dumplings in sugar syrup",
      image: menuPhotos.gulab,
      basePrice: 129,
      isVeg: true,
      preparationTime: 5,
    },
    {
      restaurantId: restaurant._id,
      categoryId: cat["Desserts"],
      name: "Ice Cream Scoop",
      description: "Choice of vanilla or chocolate",
      image: menuPhotos.iceCream,
      basePrice: 99,
      isVeg: true,
      preparationTime: 3,
    },
    {
      restaurantId: restaurant._id,
      categoryId: cat["Beverages"],
      name: "Fresh Lime Soda",
      description: "Sweet or salted",
      image: menuPhotos.lime,
      basePrice: 89,
      isVeg: true,
      preparationTime: 5,
    },
  ]);

  const supplier = await Supplier.create({
    restaurantId: restaurant._id,
    name: "Fresh Foods Wholesale",
    phone: "+91 98765 43210",
    email: "orders@freshfoods.example",
  });

  const inventories = await Inventory.insertMany([
    {
      branchId: branch._id,
      name: "Chicken (boneless)",
      sku: "CHK-001",
      unit: "kg",
      currentStock: 12,
      minStock: 5,
      costPerUnit: 280,
      valuation: 3360,
      supplierId: supplier._id,
      consumptionPerServing: 0.15,
    },
    {
      branchId: branch._id,
      name: "Paneer",
      sku: "PNR-001",
      unit: "kg",
      currentStock: 8,
      minStock: 3,
      costPerUnit: 320,
      valuation: 2560,
      supplierId: supplier._id,
      consumptionPerServing: 0.12,
    },
    {
      branchId: branch._id,
      name: "Basmati Rice",
      sku: "RCE-001",
      unit: "kg",
      currentStock: 25,
      minStock: 10,
      costPerUnit: 95,
      valuation: 2375,
      supplierId: supplier._id,
      consumptionPerServing: 0.08,
    },
    {
      branchId: branch._id,
      name: "Tomato Puree",
      sku: "SAU-001",
      unit: "L",
      currentStock: 2,
      minStock: 4,
      costPerUnit: 120,
      valuation: 240,
      supplierId: supplier._id,
      consumptionPerServing: 0.05,
    },
    {
      branchId: branch._id,
      name: "Cooking Oil",
      sku: "OIL-001",
      unit: "L",
      currentStock: 15,
      minStock: 5,
      costPerUnit: 180,
      valuation: 2700,
      supplierId: supplier._id,
      consumptionPerServing: 0.02,
    },
    {
      branchId: branch._id,
      name: "Paper Napkins",
      sku: "SUP-001",
      unit: "pack",
      currentStock: 0,
      minStock: 10,
      costPerUnit: 45,
      valuation: 0,
      supplierId: supplier._id,
    },
  ]);

  const tomato = inventories.find((i) => i.sku === "SAU-001");
  const napkins = inventories.find((i) => i.sku === "SUP-001");
  const chicken = inventories.find((i) => i.sku === "CHK-001");

  await PurchaseOrder.insertMany([
    {
      branchId: branch._id,
      supplierId: supplier._id,
      poNumber: "PO-DEMO-001",
      status: "ordered",
      items: [
        {
          inventoryId: tomato._id,
          quantity: 10,
          unitPrice: 115,
          total: 1150,
        },
        {
          inventoryId: napkins._id,
          quantity: 50,
          unitPrice: 42,
          total: 2100,
        },
      ],
      totalAmount: 3250,
      expectedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    },
    {
      branchId: branch._id,
      supplierId: supplier._id,
      poNumber: "PO-DEMO-002",
      status: "draft",
      items: [
        {
          inventoryId: chicken._id,
          quantity: 20,
          unitPrice: 275,
          total: 5500,
        },
      ],
      totalAmount: 5500,
    },
  ]);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  await Expense.insertMany([
    {
      branchId: branch._id,
      title: "Electricity bill",
      category: "utilities",
      amount: 12500,
      expenseDate: new Date(monthStart.getTime() + 2 * 24 * 60 * 60 * 1000),
      paymentMethod: "bank_transfer",
      vendor: "MSEB",
      referenceNumber: "UTIL-2026-04",
      status: "paid",
      createdBy: admin._id,
      approvedBy: admin._id,
      approvedAt: monthStart,
      paidAt: new Date(monthStart.getTime() + 3 * 24 * 60 * 60 * 1000),
    },
    {
      branchId: branch._id,
      title: "Monthly rent",
      category: "rent",
      amount: 85000,
      expenseDate: monthStart,
      paymentMethod: "bank_transfer",
      vendor: "Property Owner",
      referenceNumber: "RENT-APR-2026",
      status: "paid",
      createdBy: admin._id,
      approvedBy: admin._id,
      approvedAt: monthStart,
      paidAt: monthStart,
    },
    {
      branchId: branch._id,
      title: "Instagram ads campaign",
      category: "marketing",
      amount: 8000,
      expenseDate: new Date(),
      paymentMethod: "card",
      vendor: "Meta Ads",
      status: "approved",
      createdBy: admin._id,
      approvedBy: admin._id,
      approvedAt: new Date(),
    },
    {
      branchId: branch._id,
      title: "AC servicing",
      category: "maintenance",
      amount: 4500,
      expenseDate: new Date(),
      paymentMethod: "upi",
      vendor: "CoolAir Services",
      status: "pending",
      createdBy: admin._id,
    },
    {
      branchId: branch._id,
      title: "Kitchen exhaust cleaning",
      category: "maintenance",
      amount: 3200,
      expenseDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      paymentMethod: "cash",
      vendor: "CleanPro",
      status: "pending",
      createdBy: admin._id,
    },
  ]);

  const area = await DiningArea.create({ branchId: branch._id, name: "Main Hall" });
  for (let i = 1; i <= 5; i++) {
    await Table.create({
      branchId: branch._id,
      diningAreaId: area._id,
      number: `T${i}`,
      capacity: 4,
    });
  }

  console.log("Seed complete!");
  console.log("Admin: admin@techsan.com / Admin@123");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
