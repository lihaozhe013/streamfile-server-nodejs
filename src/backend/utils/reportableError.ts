/**
 * Error whose message is intended to reach the client or operator, such as
 * misconfiguration guidance. Anything else that reaches the global error
 * handler is summarized as a generic 500 so raw internal details (filesystem
 * paths, driver messages) never leak in responses.
 */
export class ReportableError extends Error {
  readonly status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = 'ReportableError';
    this.status = status;
  }
}
