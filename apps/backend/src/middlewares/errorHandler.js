import { StatusCodes } from "http-status-codes";
import { ApiError } from "../utils/apiError.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

export function errorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  let message = err.message || "Internal Server Error";
  let errors = err.errors || null;

  if (err.name === "ValidationError") {
    statusCode = StatusCodes.BAD_REQUEST;
    message = "Validation Error";
    errors = Object.values(err.errors).map((e) => e.message);
  }

  if (err.code === 11000) {
    statusCode = StatusCodes.CONFLICT;
    message = "Duplicate field value";
  }

  if (err.name === "CastError") {
    statusCode = StatusCodes.BAD_REQUEST;
    message = "Invalid ID format";
  }

  if (err.name === "JsonWebTokenError") {
    statusCode = StatusCodes.UNAUTHORIZED;
    message = "Invalid token";
  }

  if (!(err instanceof ApiError) && !err.isOperational) {
    logger.error("Unhandled error", { error: err.message, stack: err.stack });
    if (env.isProduction) message = "Internal Server Error";
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors,
    ...(env.nodeEnv === "development" &&
      !err.isOperational &&
      !(err instanceof ApiError) && { stack: err.stack }),
  });
}

export function notFoundHandler(req, res) {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
}
