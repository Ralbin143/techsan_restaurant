import { Router } from "express";
import * as tableController from "../../controllers/table.controller.js";
import { authenticate, requirePermission } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { PERMISSIONS } from "../../constants/roles.js";
import {
  createDiningAreaSchema,
  createTableSchema,
  updateTableSchema,
  updateStatusSchema,
} from "../../validators/table.validator.js";

const router = Router();

router.get("/qr/:token", tableController.getTableByQr);

router.use(authenticate);

const manage = [requirePermission(PERMISSIONS.TABLE_MANAGE)];

router.get("/areas", ...manage, tableController.getDiningAreas);
router.post("/areas", ...manage, validate(createDiningAreaSchema), tableController.createDiningArea);

router.get("/live", ...manage, tableController.liveMonitor);
router.get("/", ...manage, tableController.getTables);
router.get("/:id", ...manage, tableController.getTable);
router.post("/", ...manage, validate(createTableSchema), tableController.createTable);
router.patch("/:id", ...manage, validate(updateTableSchema), tableController.updateTable);
router.delete("/:id", ...manage, tableController.deleteTable);
router.patch("/:id/status", ...manage, validate(updateStatusSchema), tableController.updateTableStatus);
router.post("/:id/qr", ...manage, tableController.generateQr);
router.post("/:id/merge", ...manage, tableController.mergeTables);
router.post("/:id/split", ...manage, tableController.splitTable);

export default router;
