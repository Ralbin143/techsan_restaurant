import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

class EmailService {
  constructor() {
    if (env.smtp.host && env.smtp.user) {
      this.transporter = nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        auth: { user: env.smtp.user, pass: env.smtp.pass },
      });
    }
  }

  async sendOtp(to, code) {
    if (!this.transporter) {
      logger.info(`[DEV] OTP for ${to}: ${code}`);
      return;
    }
    await this.transporter.sendMail({
      from: env.smtp.from,
      to,
      subject: "TechSan - Password Reset OTP",
      html: `<p>Your OTP is: <strong>${code}</strong>. Valid for 10 minutes.</p>`,
    });
  }
}

export const emailService = new EmailService();
