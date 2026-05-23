import { StatusCodes } from "http-status-codes";
import { employeeService } from "../services/employee.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { resolveBranchId } from "../utils/branchResolver.js";
import { Branch } from "../models/Branch.js";
import { ValidationError } from "../utils/apiError.js";

async function resolveRestaurantId(user, queryBranchId) {
  if (user?.restaurantId) return user.restaurantId.toString();
  if (queryBranchId) {
    const branch = await Branch.findById(queryBranchId);
    if (branch?.restaurantId) return branch.restaurantId.toString();
  }
  throw new ValidationError("Restaurant context is required");
}

export const listEmployees = asyncHandler(async (req, res) => {
  const branchId = await resolveBranchId(req.user, req.query.branchId);
  const data = await employeeService.list({
    branchId,
    active: req.query.active,
    department: req.query.department,
  });
  res.json({ success: true, data });
});

export const getEmployee = asyncHandler(async (req, res) => {
  const data = await employeeService.getById(req.params.id);
  res.json({ success: true, data });
});

export const createEmployee = asyncHandler(async (req, res) => {
  const branchId = await resolveBranchId(req.user, req.body.branchId);
  const restaurantId = await resolveRestaurantId(req.user, branchId);
  const data = await employeeService.create({ ...req.body, branchId }, restaurantId);
  res.status(StatusCodes.CREATED).json({ success: true, data });
});

export const updateEmployee = asyncHandler(async (req, res) => {
  const data = await employeeService.update(req.params.id, req.body);
  res.json({ success: true, data });
});

export const deleteEmployee = asyncHandler(async (req, res) => {
  await employeeService.delete(req.params.id);
  res.json({ success: true, message: "Employee deactivated" });
});

export const listAttendance = asyncHandler(async (req, res) => {
  const branchId = await resolveBranchId(req.user, req.query.branchId);
  const data = await employeeService.listAttendance(branchId, req.query.date);
  res.json({ success: true, data });
});

export const getAttendanceRoster = asyncHandler(async (req, res) => {
  const branchId = await resolveBranchId(req.user, req.query.branchId);
  const data = await employeeService.getAttendanceRoster(branchId, req.query.date);
  res.json({ success: true, data });
});

export const upsertAttendance = asyncHandler(async (req, res) => {
  const branchId = await resolveBranchId(req.user, req.body.branchId);
  const data = await employeeService.upsertAttendance({ ...req.body, branchId });
  res.json({ success: true, data });
});

export const updateAttendance = asyncHandler(async (req, res) => {
  const data = await employeeService.updateAttendance(req.params.id, req.body);
  res.json({ success: true, data });
});

export const deleteAttendance = asyncHandler(async (req, res) => {
  await employeeService.deleteAttendance(req.params.id);
  res.json({ success: true, message: "Attendance record removed" });
});

export const getAttendanceReport = asyncHandler(async (req, res) => {
  const branchId = await resolveBranchId(req.user, req.query.branchId);
  const { from, to } = req.query;
  if (!from || !to) {
    throw new ValidationError("from and to date query parameters are required");
  }
  const data = await employeeService.getAttendanceReport(branchId, from, to);
  res.json({ success: true, data });
});

export const checkIn = asyncHandler(async (req, res) => {
  const branchId = await resolveBranchId(req.user, req.body.branchId);
  const data = await employeeService.checkIn({ ...req.body, branchId });
  res.json({ success: true, data });
});

export const checkOut = asyncHandler(async (req, res) => {
  const data = await employeeService.checkOut(req.body);
  res.json({ success: true, data });
});

export const listLeave = asyncHandler(async (req, res) => {
  const branchId = await resolveBranchId(req.user, req.query.branchId);
  const data = await employeeService.listLeave({
    branchId,
    status: req.query.status,
  });
  res.json({ success: true, data });
});

export const createLeave = asyncHandler(async (req, res) => {
  const data = await employeeService.createLeave(req.body);
  res.status(StatusCodes.CREATED).json({ success: true, data });
});

export const updateLeaveStatus = asyncHandler(async (req, res) => {
  const data = await employeeService.updateLeaveStatus(
    req.params.id,
    req.body.status,
    req.user._id
  );
  res.json({ success: true, data });
});
