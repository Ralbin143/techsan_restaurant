import { User, Employee, Attendance, Leave } from "../models/index.js";
import { NotFoundError, ValidationError } from "../utils/apiError.js";

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function combineDateAndTime(date, timeStr) {
  if (!timeStr) return null;
  const day = startOfDay(date);
  const [h, m] = timeStr.split(":").map(Number);
  day.setHours(h || 0, m || 0, 0, 0);
  return day;
}

function computeHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  if (ms <= 0) return 0;
  return Math.round((ms / 3600000) * 100) / 100;
}

function employeePopulate() {
  return { path: "userId", select: "email firstName lastName phone role isActive" };
}

export class EmployeeService {
  async nextEmployeeCode(branchId) {
    const count = await Employee.countDocuments({ branchId });
    return `EMP-${String(count + 1).padStart(3, "0")}`;
  }

  async list({ branchId, active, department }) {
    const filter = { branchId };
    if (active === "true") filter.isActive = true;
    if (active === "false") filter.isActive = false;
    if (department) filter.department = department;

    return Employee.find(filter).sort({ createdAt: -1 }).populate(employeePopulate());
  }

  async getById(id) {
    const employee = await Employee.findById(id).populate(employeePopulate());
    if (!employee) throw new NotFoundError("Employee not found");
    return employee;
  }

  async create(body, restaurantId) {
    const branchId = body.branchId;
    const email = body.email.toLowerCase().trim();

    const existingUser = await User.findOne({ email, restaurantId });
    if (existingUser) {
      throw new ValidationError("A user with this email already exists");
    }

    const user = await User.create({
      email,
      password: body.password,
      firstName: body.firstName,
      lastName: body.lastName || "",
      phone: body.phone || undefined,
      role: body.role,
      restaurantId,
      branchId,
      isEmailVerified: true,
      isActive: true,
    });

    const employeeCode = body.employeeCode?.trim() || (await this.nextEmployeeCode(branchId));

    const employee = await Employee.create({
      userId: user._id,
      branchId,
      employeeCode,
      designation: body.designation,
      department: body.department,
      joinDate: body.joinDate || new Date(),
      salary: body.salary || { base: 0, type: "monthly" },
      emergencyContact: body.emergencyContact,
      isActive: true,
    });

    return this.getById(employee._id);
  }

  async update(id, body) {
    const employee = await Employee.findById(id);
    if (!employee) throw new NotFoundError("Employee not found");

    const user = await User.findById(employee.userId);
    if (!user) throw new NotFoundError("Linked user account not found");

    if (body.firstName != null) user.firstName = body.firstName;
    if (body.lastName != null) user.lastName = body.lastName;
    if (body.phone != null) user.phone = body.phone || undefined;
    if (body.role) user.role = body.role;
    if (body.password) user.password = body.password;

    if (body.isActive != null) {
      user.isActive = body.isActive;
      employee.isActive = body.isActive;
    }

    if (body.designation != null) employee.designation = body.designation;
    if (body.department != null) employee.department = body.department;
    if (body.joinDate !== undefined) employee.joinDate = body.joinDate;
    if (body.salary) {
      employee.salary = employee.salary || { base: 0, type: "monthly" };
      if (body.salary.base != null) employee.salary.base = body.salary.base;
      if (body.salary.type) employee.salary.type = body.salary.type;
    }
    if (body.emergencyContact) employee.emergencyContact = body.emergencyContact;

    await user.save();
    await employee.save();
    return this.getById(id);
  }

  async delete(id) {
    const employee = await Employee.findById(id);
    if (!employee) throw new NotFoundError("Employee not found");

    const user = await User.findById(employee.userId);
    if (user) {
      user.isActive = false;
      await user.save();
    }

    employee.isActive = false;
    await employee.softDelete();
  }

  async listAttendance(branchId, date) {
    const day = startOfDay(date ? new Date(date) : new Date());
    return Attendance.find({ branchId, date: day })
      .populate({
        path: "employeeId",
        populate: { path: "userId", select: "firstName lastName email role" },
      })
      .sort({ checkIn: -1 });
  }

  async getAttendanceRoster(branchId, date) {
    const day = startOfDay(date ? new Date(date) : new Date());
    const [employees, records] = await Promise.all([
      Employee.find({ branchId, isActive: true })
        .sort({ employeeCode: 1 })
        .populate({ path: "userId", select: "firstName lastName email role" }),
      Attendance.find({ branchId, date: day }),
    ]);

    const recordMap = new Map(records.map((r) => [String(r.employeeId), r]));

    return employees.map((employee) => ({
      employee,
      attendance: recordMap.get(String(employee._id)) || null,
    }));
  }

  async upsertAttendance({
    employeeId,
    branchId,
    date,
    status,
    checkIn,
    checkOut,
    notes,
  }) {
    const employee = await Employee.findById(employeeId);
    if (!employee) throw new NotFoundError("Employee not found");

    const day = startOfDay(new Date(date));
    const checkInAt = combineDateAndTime(day, checkIn);
    const checkOutAt = combineDateAndTime(day, checkOut);

    if (checkInAt && checkOutAt && checkOutAt <= checkInAt) {
      throw new ValidationError("Check-out must be after check-in");
    }

    const hoursWorked = computeHours(checkInAt, checkOutAt);
    const resolvedBranch = branchId || employee.branchId;

    const att = await Attendance.findOneAndUpdate(
      { employeeId, date: day },
      {
        employeeId,
        branchId: resolvedBranch,
        date: day,
        status,
        checkIn: checkInAt,
        checkOut: checkOutAt,
        hoursWorked,
        notes: notes || "",
      },
      { upsert: true, new: true }
    );

    return att.populate({
      path: "employeeId",
      populate: { path: "userId", select: "firstName lastName email role" },
    });
  }

  async updateAttendance(id, body) {
    const att = await Attendance.findById(id);
    if (!att) throw new NotFoundError("Attendance record not found");

    const day = att.date;
    if (body.status) att.status = body.status;
    if (body.notes !== undefined) att.notes = body.notes;
    if (body.checkIn !== undefined) {
      att.checkIn = body.checkIn ? combineDateAndTime(day, body.checkIn) : null;
    }
    if (body.checkOut !== undefined) {
      att.checkOut = body.checkOut ? combineDateAndTime(day, body.checkOut) : null;
    }
    att.hoursWorked = computeHours(att.checkIn, att.checkOut);
    await att.save();

    return att.populate({
      path: "employeeId",
      populate: { path: "userId", select: "firstName lastName email role" },
    });
  }

  async deleteAttendance(id) {
    const att = await Attendance.findById(id);
    if (!att) throw new NotFoundError("Attendance record not found");
    await att.deleteOne();
  }

  async getAttendanceReport(branchId, from, to) {
    const start = startOfDay(new Date(from));
    const end = endOfDay(new Date(to));
    if (end < start) throw new ValidationError("End date must be on or after start date");

    const [employees, records] = await Promise.all([
      Employee.find({ branchId, isActive: true })
        .sort({ employeeCode: 1 })
        .populate({ path: "userId", select: "firstName lastName email role" }),
      Attendance.find({ branchId, date: { $gte: start, $lte: end } }).sort({ date: 1 }),
    ]);

    const totalDays =
      Math.floor((startOfDay(end).getTime() - start.getTime()) / 86400000) + 1;

    const presentStatuses = new Set(["present", "late", "half_day"]);

    const rows = employees.map((employee) => {
      const empRecords = records.filter(
        (r) => String(r.employeeId) === String(employee._id)
      );
      const daysPresent = empRecords.filter((r) => presentStatuses.has(r.status)).length;
      const daysAbsent = empRecords.filter((r) => r.status === "absent").length;
      const daysLeave = empRecords.filter((r) => r.status === "leave").length;
      const totalHours = empRecords.reduce((sum, r) => sum + (r.hoursWorked || 0), 0);
      const unmarked = Math.max(0, totalDays - empRecords.length);

      return {
        employee,
        daysPresent,
        daysAbsent,
        daysLeave,
        daysLate: empRecords.filter((r) => r.status === "late").length,
        daysHalfDay: empRecords.filter((r) => r.status === "half_day").length,
        unmarkedDays: unmarked,
        totalHours,
        records: empRecords,
      };
    });

    const totals = rows.reduce(
      (acc, row) => ({
        daysPresent: acc.daysPresent + row.daysPresent,
        daysAbsent: acc.daysAbsent + row.daysAbsent,
        daysLeave: acc.daysLeave + row.daysLeave,
        totalHours: acc.totalHours + row.totalHours,
      }),
      { daysPresent: 0, daysAbsent: 0, daysLeave: 0, totalHours: 0 }
    );

    return {
      from: start,
      to: end,
      totalDays,
      totals,
      rows,
    };
  }

  async checkIn({ employeeId, branchId, date, notes }) {
    const employee = await Employee.findById(employeeId);
    if (!employee) throw new NotFoundError("Employee not found");

    const day = startOfDay(date ? new Date(date) : new Date());
    const now = new Date();
    const checkInTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    return this.upsertAttendance({
      employeeId,
      branchId: branchId || employee.branchId,
      date: day,
      status: "present",
      checkIn: checkInTime,
      checkOut: null,
      notes,
    });
  }

  async checkOut({ employeeId, date, notes }) {
    const day = startOfDay(date ? new Date(date) : new Date());
    const att = await Attendance.findOne({ employeeId, date: day });
    if (!att) throw new NotFoundError("No attendance record for this date");

    const now = new Date();
    const checkOutTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    return this.upsertAttendance({
      employeeId,
      branchId: att.branchId,
      date: day,
      status: att.status === "absent" ? "present" : att.status,
      checkIn: att.checkIn
        ? `${String(new Date(att.checkIn).getHours()).padStart(2, "0")}:${String(new Date(att.checkIn).getMinutes()).padStart(2, "0")}`
        : checkOutTime,
      checkOut: checkOutTime,
      notes: notes ?? att.notes,
    });
  }

  async listLeave({ branchId, status }) {
    const employees = await Employee.find({ branchId }).select("_id");
    const ids = employees.map((e) => e._id);
    const filter = { employeeId: { $in: ids } };
    if (status) filter.status = status;

    return Leave.find(filter)
      .sort({ createdAt: -1 })
      .populate({
        path: "employeeId",
        populate: { path: "userId", select: "firstName lastName email" },
      });
  }

  async createLeave(body) {
    if (new Date(body.endDate) < new Date(body.startDate)) {
      throw new ValidationError("End date must be on or after start date");
    }
    return Leave.create(body);
  }

  async updateLeaveStatus(id, status, approvedBy) {
    const leave = await Leave.findById(id);
    if (!leave) throw new NotFoundError("Leave request not found");
    if (leave.status !== "pending") {
      throw new ValidationError("Only pending leave requests can be updated");
    }
    leave.status = status;
    leave.approvedBy = approvedBy;
    await leave.save();
    return leave.populate({
      path: "employeeId",
      populate: { path: "userId", select: "firstName lastName" },
    });
  }
}

export const employeeService = new EmployeeService();
