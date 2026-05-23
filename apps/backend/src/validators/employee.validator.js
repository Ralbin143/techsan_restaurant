import Joi from "joi";
import { ROLES } from "../constants/roles.js";

const STAFF_ROLES = [
  ROLES.MANAGER,
  ROLES.WAITER,
  ROLES.KITCHEN,
  ROLES.CASHIER,
  ROLES.RESTAURANT_ADMIN,
];

export const createEmployeeSchema = Joi.object({
  branchId: Joi.string(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  firstName: Joi.string().trim().min(1).max(80).required(),
  lastName: Joi.string().trim().max(80).allow(""),
  phone: Joi.string().trim().max(20).allow(""),
  role: Joi.string()
    .valid(...STAFF_ROLES)
    .required(),
  employeeCode: Joi.string().trim().max(32).allow(""),
  designation: Joi.string().trim().max(120).allow(""),
  department: Joi.string().trim().max(120).allow(""),
  joinDate: Joi.date().allow(null),
  salary: Joi.object({
    base: Joi.number().min(0).default(0),
    type: Joi.string().valid("monthly", "hourly").default("monthly"),
  }),
  emergencyContact: Joi.object({
    name: Joi.string().allow(""),
    phone: Joi.string().allow(""),
  }),
});

export const updateEmployeeSchema = Joi.object({
  firstName: Joi.string().trim().min(1).max(80),
  lastName: Joi.string().trim().max(80).allow(""),
  phone: Joi.string().trim().max(20).allow(""),
  role: Joi.string().valid(...STAFF_ROLES),
  password: Joi.string().min(6),
  designation: Joi.string().trim().max(120).allow(""),
  department: Joi.string().trim().max(120).allow(""),
  joinDate: Joi.date().allow(null),
  salary: Joi.object({
    base: Joi.number().min(0),
    type: Joi.string().valid("monthly", "hourly"),
  }),
  emergencyContact: Joi.object({
    name: Joi.string().allow(""),
    phone: Joi.string().allow(""),
  }),
  isActive: Joi.boolean(),
}).min(1);

export const attendanceActionSchema = Joi.object({
  employeeId: Joi.string().required(),
  branchId: Joi.string(),
  date: Joi.date(),
  notes: Joi.string().max(300).allow(""),
});

export const upsertAttendanceSchema = Joi.object({
  employeeId: Joi.string().required(),
  branchId: Joi.string(),
  date: Joi.date().required(),
  status: Joi.string().valid("present", "absent", "late", "half_day", "leave").required(),
  checkIn: Joi.string().allow("", null),
  checkOut: Joi.string().allow("", null),
  notes: Joi.string().max(300).allow(""),
});

export const updateAttendanceSchema = Joi.object({
  status: Joi.string().valid("present", "absent", "late", "half_day", "leave"),
  checkIn: Joi.string().allow("", null),
  checkOut: Joi.string().allow("", null),
  notes: Joi.string().max(300).allow(""),
}).min(1);

export const createLeaveSchema = Joi.object({
  employeeId: Joi.string().required(),
  type: Joi.string().valid("sick", "casual", "paid", "unpaid").required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  reason: Joi.string().max(500).allow(""),
});

export const leaveStatusSchema = Joi.object({
  status: Joi.string().valid("approved", "rejected").required(),
});
