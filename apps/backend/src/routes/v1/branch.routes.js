import { Router } from "express";
import { Branch } from "../../models/Branch.js";
import { authenticate } from "../../middlewares/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = req.user.restaurantId
      ? { restaurantId: req.user.restaurantId, isActive: true }
      : { isActive: true };
    const data = await Branch.find(filter).sort({ name: 1 });
    res.json({ success: true, data });
  })
);

export default router;
