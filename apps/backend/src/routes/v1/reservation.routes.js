import { Router } from "express";
import { Reservation } from "../../models/index.js";
import { authenticate, requirePermission } from "../../middlewares/auth.js";
import { PERMISSIONS } from "../../constants/roles.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { StatusCodes } from "http-status-codes";

const router = Router();

router.post("/", asyncHandler(async (req, res) => {
  const reservation = await Reservation.create(req.body);
  res.status(StatusCodes.CREATED).json({ success: true, data: reservation });
}));

router.use(authenticate, requirePermission(PERMISSIONS.RESERVATION_MANAGE));

router.get("/", asyncHandler(async (req, res) => {
  const filter = { branchId: req.query.branchId || req.user.branchId };
  if (req.query.date) {
    const d = new Date(req.query.date);
    filter.date = { $gte: d, $lt: new Date(d.getTime() + 86400000) };
  }
  const data = await Reservation.find(filter).populate("tableId");
  res.json({ success: true, data });
}));

router.patch("/:id", asyncHandler(async (req, res) => {
  const data = await Reservation.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, data });
}));

export default router;
