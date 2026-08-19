export interface AiToolErrorPayload {
  code: string;
  message: string;
  httpStatus: number;
}

export class AiToolError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus: number = 500,
  ) {
    super(message);
    this.name = "AiToolError";
  }

  toJSON(): AiToolErrorPayload {
    return { code: this.code, message: this.message, httpStatus: this.httpStatus };
  }
}
