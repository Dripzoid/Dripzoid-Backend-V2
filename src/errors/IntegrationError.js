import { AppError } from "./AppError.js";

export class IntegrationError extends AppError {
  constructor(
    message = "External integration failed",
    details = null,
    statusCode = 502
  ) {
    super(
      message,
      statusCode,
      details
    );
  }
}