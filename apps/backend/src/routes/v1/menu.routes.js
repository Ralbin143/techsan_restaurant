import { Router } from "express";
import { Category, MenuItem } from "../../models/index.js";
import { authenticate, requirePermission } from "../../middlewares/auth.js";
import { PERMISSIONS } from "../../constants/roles.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { StatusCodes } from "http-status-codes";
import { NotFoundError } from "../../utils/apiError.js";
import { validate } from "../../middlewares/validate.js";
import { categorySchema, menuItemSchema } from "../../validators/menu.validator.js";

const router = Router();

router.get(
  "/public/:restaurantId",
  asyncHandler(async (req, res) => {
    const restaurantId = req.params.restaurantId;
    const categories = await Category.find({ restaurantId, isActive: true })
      .populate("parentId", "name")
      .sort("sortOrder name")
      .lean();
    const items = await MenuItem.find({ restaurantId, isAvailable: true })
      .populate("categoryId", "name parentId sortOrder")
      .sort("sortOrder name")
      .lean();

    const grouped = categories
      .filter((c) => !c.parentId)
      .map((cat) => ({
        ...cat,
        subcategories: categories.filter(
          (sub) => sub.parentId && String(sub.parentId._id || sub.parentId) === String(cat._id)
        ),
        items: items.filter(
          (i) => i.categoryId && String(i.categoryId._id) === String(cat._id)
        ),
      }));

    for (const cat of categories.filter((c) => c.parentId)) {
      const parentId = String(cat.parentId._id || cat.parentId);
      let group = grouped.find((g) => String(g._id) === parentId);
      if (!group) {
        group = {
          _id: parentId,
          name: cat.parentId.name || "Other",
          subcategories: [],
          items: [],
        };
        grouped.push(group);
      }
      const sub = group.subcategories.find((s) => String(s._id) === String(cat._id));
      if (!sub) {
        group.subcategories.push({
          ...cat,
          items: items.filter(
            (i) => i.categoryId && String(i.categoryId._id) === String(cat._id)
          ),
        });
      }
    }

    grouped.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    res.json({ success: true, data: { categories, items, grouped } });
  })
);

router.use(authenticate);

router.get("/categories", asyncHandler(async (req, res) => {
  const restaurantId = req.user.restaurantId || req.query.restaurantId;
  if (!restaurantId) {
    return res.status(400).json({ success: false, message: "restaurantId is required" });
  }
  const data = await Category.find({ restaurantId, isActive: true })
    .populate("parentId", "name")
    .sort("sortOrder name");
  res.json({ success: true, data });
}));

router.post(
  "/categories",
  requirePermission(PERMISSIONS.MENU_MANAGE),
  validate(categorySchema),
  asyncHandler(async (req, res) => {
    const payload = { ...req.body, restaurantId: req.user.restaurantId };
    if (!payload.parentId) payload.parentId = null;
    const cat = await Category.create(payload);
    const populated = await Category.findById(cat._id).populate("parentId", "name");
    res.status(StatusCodes.CREATED).json({ success: true, data: populated });
  })
);

router.get("/items", asyncHandler(async (req, res) => {
  const restaurantId = req.user.restaurantId || req.query.restaurantId;
  if (!restaurantId) {
    return res.status(400).json({
      success: false,
      message: "restaurantId is required",
    });
  }
  const filter = { restaurantId };
  if (req.query.categoryId) filter.categoryId = req.query.categoryId;
  if (req.query.search) filter.$text = { $search: req.query.search };
  const data = await MenuItem.find(filter).populate("categoryId").sort("sortOrder name");
  res.json({ success: true, data });
}));

router.post(
  "/items",
  requirePermission(PERMISSIONS.MENU_MANAGE),
  validate(menuItemSchema),
  asyncHandler(async (req, res) => {
    const item = await MenuItem.create({ ...req.body, restaurantId: req.user.restaurantId });
    const populated = await MenuItem.findById(item._id).populate("categoryId");
    res.status(StatusCodes.CREATED).json({ success: true, data: populated });
  })
);

router.patch("/items/:id", requirePermission(PERMISSIONS.MENU_MANAGE), asyncHandler(async (req, res) => {
  const item = await MenuItem.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate(
    "categoryId"
  );
  if (!item) throw new NotFoundError("Menu item not found");
  res.json({ success: true, data: item });
}));

router.delete("/items/:id", requirePermission(PERMISSIONS.MENU_MANAGE), asyncHandler(async (req, res) => {
  const item = await MenuItem.findById(req.params.id);
  if (!item) throw new NotFoundError("Menu item not found");
  await item.softDelete();
  res.json({ success: true, message: "Menu item deleted" });
}));

router.patch(
  "/categories/:id",
  requirePermission(PERMISSIONS.MENU_MANAGE),
  validate(categorySchema),
  asyncHandler(async (req, res) => {
    const payload = { ...req.body };
    if (payload.parentId === "") payload.parentId = null;
    if (payload.parentId === req.params.id) {
      return res.status(400).json({ success: false, message: "Category cannot be its own parent" });
    }
    const cat = await Category.findByIdAndUpdate(req.params.id, payload, { new: true }).populate(
      "parentId",
      "name"
    );
    if (!cat) throw new NotFoundError("Category not found");
    res.json({ success: true, data: cat });
  })
);

router.delete("/categories/:id", requirePermission(PERMISSIONS.MENU_MANAGE), asyncHandler(async (req, res) => {
  const cat = await Category.findById(req.params.id);
  if (!cat) throw new NotFoundError("Category not found");
  await cat.softDelete();
  res.json({ success: true, message: "Category deleted" });
}));

export default router;
