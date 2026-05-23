import Joi from "joi";

export const categorySchema = Joi.object({
  name: Joi.string().required().trim(),
  description: Joi.string().allow(""),
  parentId: Joi.string().allow(null, ""),
  sortOrder: Joi.number().integer().min(0),
  kitchenStation: Joi.string().allow(""),
  image: Joi.string().allow(""),
});

export const menuItemSchema = Joi.object({
  name: Joi.string().required().trim(),
  description: Joi.string().allow(""),
  categoryId: Joi.string().required(),
  basePrice: Joi.number().min(0).required(),
  isVeg: Joi.boolean(),
  isAvailable: Joi.boolean(),
  preparationTime: Joi.number().integer().min(1),
  sortOrder: Joi.number().integer().min(0),
});
