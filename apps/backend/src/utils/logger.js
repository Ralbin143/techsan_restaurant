import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { env } from "../config/env.js";

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
        return `${timestamp} [${level}]: ${message}${extra}`;
      })
    ),
  }),
];

if (env.isProduction) {
  transports.push(
    new DailyRotateFile({
      filename: "logs/app-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxFiles: "14d",
    })
  );
}

export const logger = winston.createLogger({
  level: env.isProduction ? "info" : "debug",
  transports,
});
