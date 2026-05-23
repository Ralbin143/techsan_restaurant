import { Inventory, StockTransaction, MenuItem } from "../models/index.js";
import { Notification } from "../models/Notification.js";
import { NotFoundError } from "../utils/apiError.js";

export class InventoryService {
  async deductForOrder(order) {
    for (const item of order.items) {
      const menuItem = await MenuItem.findById(item.menuItemId);
      if (!menuItem) continue;

      const inventories = await Inventory.find({
        branchId: order.branchId,
        menuItemIds: menuItem._id,
      });

      for (const inv of inventories) {
        const qty = inv.consumptionPerServing * item.quantity;
        const previousStock = inv.currentStock;
        inv.currentStock = Math.max(0, inv.currentStock - qty);
        inv.valuation = inv.currentStock * inv.costPerUnit;
        await inv.save();

        await StockTransaction.create({
          branchId: order.branchId,
          inventoryId: inv._id,
          type: "out",
          quantity: qty,
          reason: `Order ${order.orderNumber}`,
          orderId: order._id,
          previousStock,
          newStock: inv.currentStock,
        });

        if (inv.currentStock <= inv.minStock) {
          await Notification.create({
            branchId: order.branchId,
            type: "low_stock",
            title: "Low Stock Alert",
            body: `${inv.name} is below minimum (${inv.currentStock} ${inv.unit})`,
            data: { inventoryId: inv._id },
          });
        }
      }
    }
  }

  async adjustStock(
    inventoryId,
    { type, quantity, reason, performedBy, branchId, purchaseOrderId }
  ) {
    const inv = await Inventory.findById(inventoryId);
    if (!inv) throw new NotFoundError("Inventory item not found");

    const previousStock = inv.currentStock;
    if (type === "in") inv.currentStock += quantity;
    else if (type === "out" || type === "waste") inv.currentStock = Math.max(0, inv.currentStock - quantity);
    else inv.currentStock = quantity;

    inv.valuation = inv.currentStock * inv.costPerUnit;
    if (type === "in") inv.lastRestockedAt = new Date();
    await inv.save();

    const tx = await StockTransaction.create({
      branchId: branchId || inv.branchId,
      inventoryId: inv._id,
      type,
      quantity,
      reason,
      performedBy,
      purchaseOrderId,
      previousStock,
      newStock: inv.currentStock,
    });

    return { transaction: tx, inventory: inv };
  }
}

export const inventoryService = new InventoryService();
