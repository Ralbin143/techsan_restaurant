import Joi from "joi";
import { PAYMENT_METHOD } from "../models/Payment.js";

const counterMethods = [
  PAYMENT_METHOD.CASH,
  PAYMENT_METHOD.CARD,
  PAYMENT_METHOD.UPI,
  PAYMENT_METHOD.WALLET,
];

export const processPaymentSchema = Joi.object({
  orderId: Joi.string().required(),
  method: Joi.string()
    .valid(...counterMethods)
    .required(),
  amount: Joi.number().min(0),
  tip: Joi.number().min(0).default(0),
});
