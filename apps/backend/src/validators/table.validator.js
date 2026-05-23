import Joi from "joi";

export const createDiningAreaSchema = Joi.object({
  branchId: Joi.string(),
  name: Joi.string().required().trim(),
  description: Joi.string().allow(""),
  sortOrder: Joi.number().integer().min(0),
});

export const createTableSchema = Joi.object({
  branchId: Joi.string(),
  diningAreaId: Joi.string().required(),
  number: Joi.string().required().trim(),
  capacity: Joi.number().integer().min(1).max(50).default(4),
  status: Joi.string().valid("available", "occupied", "reserved", "cleaning"),
});

export const updateTableSchema = Joi.object({
  diningAreaId: Joi.string(),
  number: Joi.string().trim(),
  capacity: Joi.number().integer().min(1).max(50),
  status: Joi.string().valid("available", "occupied", "reserved", "cleaning"),
  isActive: Joi.boolean(),
}).min(1);

export const updateStatusSchema = Joi.object({
  status: Joi.string().valid("available", "occupied", "reserved", "cleaning").required(),
});
