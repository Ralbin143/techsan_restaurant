import { PurchaseOrder, Inventory, Supplier } from "../models/index.js";
import { inventoryService } from "./inventory.service.js";
import { NotFoundError, ValidationError } from "../utils/apiError.js";

function generatePoNumber() {
  return `PO-${Date.now().toString(36).toUpperCase()}`;
}

function computeLines(items) {
  return items.map((line) => {
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.unitPrice);
    return {
      inventoryId: line.inventoryId,
      quantity,
      unitPrice,
      total: quantity * unitPrice,
    };
  });
}

export class PurchaseService {
  async list({ branchId, status }) {
    const filter = { branchId };
    if (status && status !== "all") filter.status = status;

    return PurchaseOrder.find(filter)
      .sort({ createdAt: -1 })
      .populate("supplierId", "name phone email contactPerson")
      .populate("items.inventoryId", "name unit sku currentStock");
  }

  async getById(id) {
    const po = await PurchaseOrder.findById(id)
      .populate("supplierId", "name phone email contactPerson address paymentTerms")
      .populate("items.inventoryId", "name unit sku currentStock costPerUnit");
    if (!po) throw new NotFoundError("Purchase order not found");
    return po;
  }

  async create(body) {
    const items = computeLines(body.items);
    const totalAmount = items.reduce((sum, line) => sum + line.total, 0);

    return PurchaseOrder.create({
      branchId: body.branchId,
      supplierId: body.supplierId,
      poNumber: generatePoNumber(),
      items,
      totalAmount,
      status: body.status === "ordered" ? "ordered" : "draft",
      expectedDelivery: body.expectedDelivery || undefined,
    });
  }

  async update(id, body) {
    const po = await PurchaseOrder.findById(id);
    if (!po) throw new NotFoundError("Purchase order not found");
    if (po.status !== "draft") {
      throw new ValidationError("Only draft purchase orders can be edited");
    }

    if (body.supplierId) po.supplierId = body.supplierId;
    if (body.expectedDelivery !== undefined) po.expectedDelivery = body.expectedDelivery;
    if (body.items) {
      po.items = computeLines(body.items);
      po.totalAmount = po.items.reduce((sum, line) => sum + line.total, 0);
    }

    await po.save();
    return this.getById(id);
  }

  async submit(id) {
    const po = await PurchaseOrder.findById(id);
    if (!po) throw new NotFoundError("Purchase order not found");
    if (po.status !== "draft") {
      throw new ValidationError("Only draft purchase orders can be submitted");
    }
    po.status = "ordered";
    await po.save();
    return this.getById(id);
  }

  async receive(id, performedBy) {
    const po = await PurchaseOrder.findById(id);
    if (!po) throw new NotFoundError("Purchase order not found");
    if (po.status !== "ordered") {
      throw new ValidationError("Only ordered purchase orders can be received");
    }

    for (const line of po.items) {
      if (!line.inventoryId) continue;

      const inv = await Inventory.findById(line.inventoryId);
      if (!inv) continue;

      await inventoryService.adjustStock(line.inventoryId, {
        type: "in",
        quantity: line.quantity,
        reason: `Received ${po.poNumber}`,
        performedBy,
        branchId: po.branchId,
        purchaseOrderId: po._id,
      });

      if (line.unitPrice != null && line.unitPrice >= 0) {
        const refreshed = await Inventory.findById(line.inventoryId);
        if (refreshed) {
          refreshed.costPerUnit = line.unitPrice;
          refreshed.valuation = refreshed.currentStock * refreshed.costPerUnit;
          await refreshed.save();
        }
      }
    }

    po.status = "received";
    po.receivedAt = new Date();
    await po.save();
    return this.getById(id);
  }

  async cancel(id) {
    const po = await PurchaseOrder.findById(id);
    if (!po) throw new NotFoundError("Purchase order not found");
    if (po.status === "received") {
      throw new ValidationError("Received purchase orders cannot be cancelled");
    }
    if (po.status === "cancelled") {
      throw new ValidationError("Purchase order is already cancelled");
    }
    po.status = "cancelled";
    await po.save();
    return this.getById(id);
  }

  async delete(id) {
    const po = await PurchaseOrder.findById(id);
    if (!po) throw new NotFoundError("Purchase order not found");
    if (po.status !== "draft") {
      throw new ValidationError("Only draft purchase orders can be deleted");
    }
    await po.deleteOne();
  }

  async listSuppliers(restaurantId) {
    return Supplier.find({ restaurantId, isActive: { $ne: false } }).sort({ name: 1 });
  }

  async createSupplier(restaurantId, body) {
    return Supplier.create({ ...body, restaurantId });
  }

  async updateSupplier(id, restaurantId, body) {
    const supplier = await Supplier.findOne({ _id: id, restaurantId });
    if (!supplier) throw new NotFoundError("Supplier not found");
    Object.assign(supplier, body);
    await supplier.save();
    return supplier;
  }
}

export const purchaseService = new PurchaseService();
