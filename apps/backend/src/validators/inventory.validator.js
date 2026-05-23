import Joi from "joi";

const inventoryFields = {
  branchId: Joi.string(),
  name: Joi.string().trim().min(1).max(200),
  sku: Joi.string().trim().max(64).allow(""),
  barcode: Joi.string().trim().max(64).allow(""),
  unit: Joi.string().trim().min(1).max(32),
  currentStock: Joi.number().min(0),
  minStock: Joi.number().min(0),
  maxStock: Joi.number().min(0).allow(null),
  costPerUnit: Joi.number().min(0),
  consumptionPerServing: Joi.number().min(0),
  supplierId: Joi.string().allow(null, ""),
};

export const createInventorySchema = Joi.object({
  ...inventoryFields,
  branchId: inventoryFields.branchId.required(),
  name: inventoryFields.name.required(),
  unit: inventoryFields.unit.required(),
}).unknown(false);

export const updateInventorySchema = Joi.object(inventoryFields).min(1).unknown(false);

export const adjustStockSchema = Joi.object({
  type: Joi.string().valid("in", "out", "waste", "adjustment").required(),
  quantity: Joi.number().min(0).required(),
  reason: Joi.string().max(500).allow(""),
});
