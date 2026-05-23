import { Router } from "express";
import { Payroll } from "../../models/index.js";
import * as employeeController from "../../controllers/employee.controller.js";
import { authenticate, requirePermission } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { PERMISSIONS } from "../../constants/roles.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { resolveBranchId } from "../../utils/branchResolver.js";
import {
  attendanceActionSchema,
  createEmployeeSchema,
  createLeaveSchema,
  leaveStatusSchema,
  updateEmployeeSchema,
  upsertAttendanceSchema,
  updateAttendanceSchema,
} from "../../validators/employee.validator.js";

const router = Router();
router.use(authenticate);

const manage = requirePermission(PERMISSIONS.EMPLOYEE_MANAGE);

router.get("/", manage, employeeController.listEmployees);
router.post("/", manage, validate(createEmployeeSchema), employeeController.createEmployee);

router.get("/attendance/list", manage, employeeController.listAttendance);
router.get("/attendance/roster", manage, employeeController.getAttendanceRoster);
router.get("/attendance/report", manage, employeeController.getAttendanceReport);
router.post(
  "/attendance/upsert",
  manage,
  validate(upsertAttendanceSchema),
  employeeController.upsertAttendance
);
router.patch(
  "/attendance/:id",
  manage,
  validate(updateAttendanceSchema),
  employeeController.updateAttendance
);
router.delete("/attendance/:id", manage, employeeController.deleteAttendance);
router.post(
  "/attendance/check-in",
  manage,
  validate(attendanceActionSchema),
  employeeController.checkIn
);
router.post(
  "/attendance/check-out",
  manage,
  validate(attendanceActionSchema),
  employeeController.checkOut
);

router.get("/leave/list", manage, employeeController.listLeave);
router.post("/leave", manage, validate(createLeaveSchema), employeeController.createLeave);
router.patch(
  "/leave/:id/status",
  manage,
  validate(leaveStatusSchema),
  employeeController.updateLeaveStatus
);

router.get(
  "/payroll/list",
  requirePermission(PERMISSIONS.PAYROLL_MANAGE),
  asyncHandler(async (req, res) => {
    const branchId = await resolveBranchId(req.user, req.query.branchId);
    const data = await Payroll.find({
      branchId,
      month: Number(req.query.month),
      year: Number(req.query.year),
    }).populate({
      path: "employeeId",
      populate: { path: "userId", select: "firstName lastName email" },
    });
    res.json({ success: true, data });
  })
);

router.get("/:id", manage, employeeController.getEmployee);
router.patch("/:id", manage, validate(updateEmployeeSchema), employeeController.updateEmployee);
router.delete("/:id", manage, employeeController.deleteEmployee);

export default router;
