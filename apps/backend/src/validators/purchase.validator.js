import Joi from "joi";

const poLineSchema = Joi.object({
  inventoryId: Joi.string().required(),
  quantity: Joi.number().greater(0).required(),
  unitPrice: Joi.number().min(0).required(),
});

export const createPurchaseOrderSchema = Joi.object({
  branchId: Joi.string(),
  supplierId: Joi.string().required(),
  items: Joi.array().items(poLineSchema).min(1).required(),
  expectedDelivery: Joi.date().allow(null),
  status: Joi.string().valid("draft", "ordered"),
});

export const updatePurchaseOrderSchema = Joi.object({
  supplierId: Joi.string(),
  items: Joi.array().items(poLineSchema).min(1),
  expectedDelivery: Joi.date().allow(null),
});

export const createSupplierSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  contactPerson: Joi.string().trim().max(120).allow(""),
  email: Joi.string().email().allow(""),
  phone: Joi.string().trim().max(32).allow(""),
  address: Joi.string().trim().max(500).allow(""),
  paymentTerms: Joi.string().trim().max(200).allow(""),
  isActive: Joi.boolean(),
});

export const updateSupplierSchema = createSupplierSchema.fork(["name"], (s) => s.optional());
