import fetch from "node-fetch";

export interface ApifyClientOptions {
  token: string;
  baseUrl?: string;
}

export class ApifyClient {
  constructor(private readonly options: ApifyClientOptions) {}

  private normalizeActorIdForUrl(actorId: string): string {
    return actorId.replace(/\//g, "~");
  }

  public async runActorDataset<TInput, TResult>(
    actorId: string,
    input: TInput
  ): Promise<TResult[]> {
    const token = this.options.token;
    const baseUrl = (this.options.baseUrl ?? "https://api.apify.com").replace(/\/+$/, "");
    if (!token) {
      throw new Error("Apify token is required");
    }

    const actorPath = this.normalizeActorIdForUrl(actorId);
    const url = `${baseUrl}/v2/acts/${actorPath}/run-sync-get-dataset-items?token=${encodeURIComponent(
      token
    )}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input ?? {}),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Apify run failed: ${resp.status} ${resp.statusText} - ${text}`);
    }

    const data = (await resp.json()) as TResult[] | undefined;
    return data ?? [];
  }
}
