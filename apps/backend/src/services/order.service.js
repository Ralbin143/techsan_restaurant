import { Order, ORDER_STATUS, MenuItem, Table, TABLE_STATUS } from "../models/index.js";
import { NotFoundError, ValidationError } from "../utils/apiError.js";
import { inventoryService } from "./inventory.service.js";
import { Branch } from "../models/Branch.js";

function generateOrderNumber() {
  return `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export class OrderService {
  async resolveBranchIdForOrder(data, user) {
    if (data.branchId) return data.branchId;
    if (user?.branchId) return user.branchId;
    if (user?.restaurantId) {
      const branch = await Branch.findOne({ restaurantId: user.restaurantId, isActive: true });
      if (branch) return branch._id;
    }
    throw new ValidationError("branchId is required to create an order");
  }

  async create(data, user) {
    const branchId = await this.resolveBranchIdForOrder(data, user);
    const items = await this.buildOrderItems(data.items);
    const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const tax = data.tax ?? subtotal * 0.05;
    const discount = data.discount ?? 0;
    const total = subtotal + tax + (data.serviceCharge ?? 0) - discount;

    const order = await Order.create({
      orderNumber: generateOrderNumber(),
      branchId,
      tableId: data.tableId,
      items,
      status: ORDER_STATUS.PENDING,
      source: data.source,
      priority: data.priority || "normal",
      waiterId: user?.role !== "customer" ? user?._id : data.waiterId,
      guestSessionId: data.guestSessionId,
      subtotal,
      tax,
      discount,
      serviceCharge: data.serviceCharge ?? 0,
      total,
      notes: data.notes,
    });

    if (data.tableId) {
      await Table.findByIdAndUpdate(data.tableId, {
        status: TABLE_STATUS.OCCUPIED,
        currentOrderId: order._id,
      });
    }

    return order.populate("items.menuItemId tableId waiterId");
  }

  async buildOrderItems(lineItems) {
    const built = [];
    for (const line of lineItems) {
      const menuItem = await MenuItem.findById(line.menuItemId);
      if (!menuItem || !menuItem.isAvailable) {
        throw new ValidationError(`Item unavailable: ${line.menuItemId}`);
      }
      const variant = line.variantId
        ? menuItem.variants.id(line.variantId)
        : menuItem.variants.find((v) => v.isDefault);
      const unitPrice =
        variant?.price ?? menuItem.basePrice + (line.addons?.reduce((s, a) => s + a.price, 0) || 0);

      built.push({
        menuItemId: menuItem._id,
        name: menuItem.name,
        quantity: line.quantity,
        unitPrice,
        variant: variant ? { name: variant.name, price: variant.price } : undefined,
        addons: line.addons,
        notes: line.notes,
        kitchenStation: menuItem.kitchenStation,
        status: "pending",
      });
    }
    return built;
  }

  async updateStatus(orderId, status, itemUpdates) {
    const order = await Order.findById(orderId);
    if (!order) throw new NotFoundError("Order not found");

    if (status) order.status = status;
    if (itemUpdates?.length) {
      for (const upd of itemUpdates) {
        const item = order.items.id(upd.itemId);
        if (item) {
          item.status = upd.status;
          if (upd.status === "preparing") item.startedAt = new Date();
          if (upd.status === "ready") item.readyAt = new Date();
        }
      }
    }

    if (status === ORDER_STATUS.COMPLETED) {
      order.completedAt = new Date();
      await inventoryService.deductForOrder(order);
      if (order.tableId) {
        await Table.findByIdAndUpdate(order.tableId, {
          status: TABLE_STATUS.CLEANING,
          currentOrderId: null,
        });
      }
    }

    await order.save();
    return order.populate("items.menuItemId tableId waiterId");
  }

  async getKitchenQueue(branchId, filters = {}) {
    const query = {
      branchId,
      status: { $in: [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED, ORDER_STATUS.PREPARING, ORDER_STATUS.READY] },
    };
    if (filters.station) query["items.kitchenStation"] = filters.station;
    return Order.find(query).sort({ priority: -1, createdAt: 1 }).populate("tableId waiterId");
  }

  async callWaiter(orderId) {
    return Order.findByIdAndUpdate(orderId, { callWaiter: true }, { new: true });
  }

  async requestBill(orderId) {
    return Order.findByIdAndUpdate(orderId, { requestBill: true }, { new: true });
  }

  async updateServiceRequests(orderId, { callWaiter, requestBill }) {
    const update = {};
    if (callWaiter !== undefined) update.callWaiter = callWaiter;
    if (requestBill !== undefined) update.requestBill = requestBill;
    if (!Object.keys(update).length) {
      throw new ValidationError("At least one service request field is required");
    }

    const order = await Order.findByIdAndUpdate(orderId, update, { new: true });
    if (!order) throw new NotFoundError("Order not found");
    return order.populate("tableId waiterId items.menuItemId");
  }

  async releaseTableAfterCancel(order) {
    if (!order.tableId) return;

    const tableId = order.tableId._id || order.tableId;
    const otherActive = await Order.findOne({
      tableId,
      _id: { $ne: order._id },
      status: { $nin: [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED] },
    }).sort({ createdAt: -1 });

    if (otherActive) {
      await Table.findByIdAndUpdate(tableId, {
        currentOrderId: otherActive._id,
        status: TABLE_STATUS.OCCUPIED,
      });
    } else {
      await Table.findByIdAndUpdate(tableId, {
        status: TABLE_STATUS.AVAILABLE,
        currentOrderId: null,
      });
    }
  }

  async cancelOrder(orderId, { reason } = {}, { isGuest = false } = {}) {
    const order = await Order.findById(orderId);
    if (!order) throw new NotFoundError("Order not found");

    if ([ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED].includes(order.status)) {
      throw new ValidationError(`Cannot cancel an order that is already ${order.status}`);
    }

    const guestCancellable = [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED];
    if (isGuest && !guestCancellable.includes(order.status)) {
      throw new ValidationError(
        "This order can no longer be cancelled. Please ask staff for help."
      );
    }

    order.status = ORDER_STATUS.CANCELLED;
    order.callWaiter = false;
    order.requestBill = false;

    const trimmedReason = reason?.trim() || "";
    if (isGuest) {
      order.cancelReason = trimmedReason || "Cancelled by guest";
    } else {
      order.cancelReason = trimmedReason || "Cancelled by the restaurant";
    }

    if (trimmedReason) {
      const note = `[Cancelled] ${trimmedReason}`;
      order.notes = order.notes ? `${order.notes}\n${note}` : note;
    }
    for (const item of order.items) {
      if (item.status !== "cancelled") item.status = "cancelled";
    }

    await order.save();
    await this.releaseTableAfterCancel(order);
    return order.populate("items.menuItemId tableId waiterId");
  }

  async markBillDelivered(orderId, { completeOrder = true } = {}) {
    const order = await Order.findById(orderId);
    if (!order) throw new NotFoundError("Order not found");

    order.requestBill = false;

    if (
      completeOrder &&
      [ORDER_STATUS.SERVED, ORDER_STATUS.READY].includes(order.status)
    ) {
      order.status = ORDER_STATUS.COMPLETED;
      order.completedAt = new Date();
      if (order.tableId) {
        await Table.findByIdAndUpdate(order.tableId, {
          status: TABLE_STATUS.CLEANING,
          currentOrderId: null,
        });
      }
    }

    await order.save();
    return order.populate("tableId waiterId items.menuItemId");
  }
}

export const orderService = new OrderService();
