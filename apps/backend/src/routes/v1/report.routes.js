import { Router } from "express";
import * as reportController from "../../controllers/report.controller.js";
import { authenticate, requirePermission } from "../../middlewares/auth.js";
import { PERMISSIONS } from "../../constants/roles.js";

const router = Router();
router.use(authenticate, requirePermission(PERMISSIONS.REPORT_VIEW));

router.get("/daily-sales", reportController.dailySales);
router.get("/top-items", reportController.topItems);
router.get("/peak-hours", reportController.peakHours);
router.get("/forecast", reportController.salesForecast);

export default router;
