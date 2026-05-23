import { StatusCodes } from "http-status-codes";
import { tableService } from "../services/table.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { resolveBranchId } from "../utils/branchResolver.js";

export const createDiningArea = asyncHandler(async (req, res) => {
  const branchId = await resolveBranchId(req.user, req.body.branchId);
  const area = await tableService.createDiningArea({ ...req.body, branchId });
  res.status(StatusCodes.CREATED).json({ success: true, data: area });
});

export const getDiningAreas = asyncHandler(async (req, res) => {
  const branchId = await resolveBranchId(req.user, req.query.branchId);
  const data = await tableService.listDiningAreas(branchId);
  res.json({ success: true, data });
});

export const createTable = asyncHandler(async (req, res) => {
  const branchId = await resolveBranchId(req.user, req.body.branchId);
  const table = await tableService.createTable({ ...req.body, branchId });
  res.status(StatusCodes.CREATED).json({ success: true, data: table });
});

export const getTables = asyncHandler(async (req, res) => {
  const branchId = await resolveBranchId(req.user, req.query.branchId);
  const tables = await tableService.getLiveMonitor(branchId);
  res.json({ success: true, data: tables });
});

export const getTable = asyncHandler(async (req, res) => {
  const table = await tableService.getById(req.params.id);
  res.json({ success: true, data: table });
});

export const getTableByQr = asyncHandler(async (req, res) => {
  const table = await tableService.getByQrToken(req.params.token);
  res.json({ success: true, data: table });
});

export const updateTable = asyncHandler(async (req, res) => {
  const table = await tableService.updateTable(req.params.id, req.body);
  req.app.get("io")?.to(`branch:${table.branchId}`).emit("table:updated", table);
  res.json({ success: true, data: table });
});

export const deleteTable = asyncHandler(async (req, res) => {
  await tableService.deleteTable(req.params.id);
  res.json({ success: true, message: "Table deleted" });
});

export const generateQr = asyncHandler(async (req, res) => {
  const table = await tableService.generateQr(req.params.id);
  res.json({ success: true, data: table });
});

export const mergeTables = asyncHandler(async (req, res) => {
  const table = await tableService.mergeTables(req.params.id, req.body.tableIds);
  res.json({ success: true, data: table });
});

export const splitTable = asyncHandler(async (req, res) => {
  const table = await tableService.splitTable(req.params.id);
  res.json({ success: true, data: table });
});

export const liveMonitor = asyncHandler(async (req, res) => {
  const branchId = await resolveBranchId(req.user, req.query.branchId);
  const tables = await tableService.getLiveMonitor(branchId);
  res.json({ success: true, data: tables });
});

export const updateTableStatus = asyncHandler(async (req, res) => {
  const table = await tableService.updateStatus(req.params.id, req.body.status);
  req.app.get("io")?.to(`branch:${table.branchId}`).emit("table:updated", table);
  res.json({ success: true, data: table });
});
