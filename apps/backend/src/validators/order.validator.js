import Joi from "joi";

const orderItemSchema = Joi.object({
  menuItemId: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required(),
  variantId: Joi.string(),
  addons: Joi.array().items(
    Joi.object({ name: Joi.string(), price: Joi.number(), quantity: Joi.number() })
  ),
  notes: Joi.string().max(500),
});

export const createOrderSchema = Joi.object({
  branchId: Joi.string(),
  tableId: Joi.string(),
  items: Joi.array().items(orderItemSchema).min(1).required(),
  source: Joi.string().valid("qr", "waiter", "cashier", "online"),
  priority: Joi.string().valid("normal", "high", "rush"),
  notes: Joi.string().max(1000),
  discount: Joi.number().min(0),
  tax: Joi.number().min(0),
  serviceCharge: Joi.number().min(0),
});

export const updateOrderStatusSchema = Joi.object({
  status: Joi.string().valid("pending", "confirmed", "preparing", "ready", "served", "completed", "cancelled"),
  itemUpdates: Joi.array().items(
    Joi.object({
      itemId: Joi.string().required(),
      status: Joi.string().valid("pending", "preparing", "ready", "served", "cancelled"),
    })
  ),
});

export const updateServiceRequestsSchema = Joi.object({
  callWaiter: Joi.boolean(),
  requestBill: Joi.boolean(),
}).min(1);

export const markBillDeliveredSchema = Joi.object({
  completeOrder: Joi.boolean().default(true),
});

export const cancelOrderSchema = Joi.object({
  reason: Joi.string().max(500).allow(""),
});
