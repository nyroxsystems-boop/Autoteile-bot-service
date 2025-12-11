export class ApifyError extends Error {
  status: number;
  actorId?: string;
  taskId?: string;
  bodySnippet?: string;

  constructor(params: { message: string; status: number; actorId?: string; taskId?: string; bodySnippet?: string }) {
    super(params.message);
    this.name = "ApifyError";
    this.status = params.status;
    this.actorId = params.actorId;
    this.taskId = params.taskId;
    this.bodySnippet = params.bodySnippet;
  }
}
