import { GraphQLError } from "graphql";

export type ErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "INTERNAL_SERVER_ERROR";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  AUTHENTICATION_REQUIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500
};

export class AppError extends GraphQLError {
  constructor(message: string, code: ErrorCode) {
    super(message, {
      extensions: { code, http: { status: STATUS_BY_CODE[code] } }
    });
    this.name = this.constructor.name;
  }
}

export class AuthenticationRequiredError extends AppError {
  constructor(message = "Authentication required") {
    super(message, "AUTHENTICATION_REQUIRED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(message, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, "NOT_FOUND");
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, "CONFLICT");
  }
}

export class InternalServerError extends AppError {
  constructor(message = "Internal server error") {
    super(message, "INTERNAL_SERVER_ERROR");
  }
}
