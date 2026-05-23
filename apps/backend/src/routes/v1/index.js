import { Router } from "express";
import authRoutes from "./auth.routes.js";
import orderRoutes from "./order.routes.js";
import tableRoutes from "./table.routes.js";
import menuRoutes from "./menu.routes.js";
import paymentRoutes from "./payment.routes.js";
import reportRoutes from "./report.routes.js";
import inventoryRoutes from "./inventory.routes.js";
import purchaseRoutes from "./purchase.routes.js";
import employeeRoutes from "./employee.routes.js";
import expenseRoutes from "./expense.routes.js";
import reservationRoutes from "./reservation.routes.js";
import branchRoutes from "./branch.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/orders", orderRoutes);
router.use("/tables", tableRoutes);
router.use("/menu", menuRoutes);
router.use("/payments", paymentRoutes);
router.use("/reports", reportRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/purchases", purchaseRoutes);
router.use("/employees", employeeRoutes);
router.use("/expenses", expenseRoutes);
router.use("/reservations", reservationRoutes);
router.use("/branches", branchRoutes);

router.get("/health", (_req, res) => {
  res.json({ success: true, status: "ok", timestamp: new Date().toISOString() });
});

export default router;
