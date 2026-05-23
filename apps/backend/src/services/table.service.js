import QRCode from "qrcode";
import { v4 as uuidv4 } from "uuid";
import { Table, DiningArea, TABLE_STATUS } from "../models/index.js";
import { NotFoundError, ValidationError } from "../utils/apiError.js";
import { env } from "../config/env.js";

export class TableService {
  async createDiningArea(data) {
    return DiningArea.create(data);
  }

  async getById(tableId) {
    const table = await Table.findById(tableId).populate("diningAreaId branchId");
    if (!table) throw new NotFoundError("Table not found");
    return table;
  }

  async createTable(data) {
    const qrToken = uuidv4();
    const table = await Table.create({ ...data, qrToken });
    const qrUrl = `${env.adminUrl}/order/${qrToken}`;
    table.qrCode = await QRCode.toDataURL(qrUrl);
    await table.save();
    return table;
  }

  async generateQr(tableId) {
    const table = await Table.findById(tableId);
    if (!table) throw new NotFoundError("Table not found");
    if (!table.qrToken) table.qrToken = uuidv4();
    const qrUrl = `${env.adminUrl}/order/${table.qrToken}`;
    table.qrCode = await QRCode.toDataURL(qrUrl);
    await table.save();
    return table;
  }

  async mergeTables(primaryId, secondaryIds) {
    const primary = await Table.findById(primaryId);
    if (!primary) throw new NotFoundError("Primary table not found");
    primary.mergedWith = [...new Set([...primary.mergedWith.map(String), ...secondaryIds])];
    primary.status = TABLE_STATUS.OCCUPIED;
    await primary.save();
    await Table.updateMany(
      { _id: { $in: secondaryIds } },
      { status: TABLE_STATUS.OCCUPIED, mergedWith: [primaryId] }
    );
    return primary;
  }

  async splitTable(tableId) {
    const table = await Table.findById(tableId);
    if (!table) throw new NotFoundError("Table not found");
    const mergedIds = table.mergedWith;
    table.mergedWith = [];
    table.status = TABLE_STATUS.AVAILABLE;
    await table.save();
    if (mergedIds.length) {
      await Table.updateMany({ _id: { $in: mergedIds } }, { mergedWith: [], status: TABLE_STATUS.AVAILABLE });
    }
    return table;
  }

  async getByQrToken(qrToken) {
    const table = await Table.findOne({ qrToken, isActive: true }).populate("diningAreaId branchId");
    if (!table) throw new NotFoundError("Invalid QR code");
    return table;
  }

  async updateStatus(tableId, status) {
    if (!Object.values(TABLE_STATUS).includes(status)) {
      throw new ValidationError("Invalid table status");
    }
    return Table.findByIdAndUpdate(tableId, { status }, { new: true });
  }

  async getLiveMonitor(branchId) {
    return Table.find({ branchId, isActive: true })
      .populate("diningAreaId assignedWaiterId currentOrderId")
      .sort("number");
  }

  async updateTable(tableId, data) {
    const table = await Table.findById(tableId);
    if (!table) throw new NotFoundError("Table not found");

    if (data.number && data.number !== table.number) {
      const exists = await Table.findOne({
        branchId: table.branchId,
        number: data.number,
        _id: { $ne: tableId },
      });
      if (exists) throw new ValidationError(`Table number ${data.number} already exists`);
    }

    Object.assign(table, data);
    await table.save();
    return table.populate("diningAreaId");
  }

  async deleteTable(tableId) {
    const table = await Table.findById(tableId);
    if (!table) throw new NotFoundError("Table not found");
    if (table.status === TABLE_STATUS.OCCUPIED) {
      throw new ValidationError("Cannot delete an occupied table");
    }
    await table.softDelete();
    return table;
  }

  async listDiningAreas(branchId) {
    return DiningArea.find({ branchId, isActive: true }).sort("sortOrder name");
  }
}

export const tableService = new TableService();
