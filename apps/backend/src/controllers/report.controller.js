import { reportService } from "../services/report.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const dailySales = asyncHandler(async (req, res) => {
  const data = await reportService.dailySales(
    req.query.branchId || req.user.branchId,
    req.query.date ? new Date(req.query.date) : new Date()
  );
  res.json({ success: true, data });
});

export const topItems = asyncHandler(async (req, res) => {
  const from = new Date(req.query.from || Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = new Date(req.query.to || Date.now());
  const data = await reportService.topSellingItems(req.query.branchId || req.user.branchId, {
    from,
    to,
    limit: parseInt(req.query.limit || "10", 10),
  });
  res.json({ success: true, data });
});

export const peakHours = asyncHandler(async (req, res) => {
  const data = await reportService.peakHours(
    req.query.branchId || req.user.branchId,
    new Date(req.query.date || Date.now())
  );
  res.json({ success: true, data });
});

export const salesForecast = asyncHandler(async (req, res) => {
  const data = await reportService.salesForecast(req.query.branchId || req.user.branchId);
  res.json({ success: true, data });
});
