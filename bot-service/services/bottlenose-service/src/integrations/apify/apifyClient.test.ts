import { createApifyClient } from "./apifyClient";
import { ApifyError } from "./apifyErrors";

jest.mock("node-fetch", () => jest.fn());
import fetch from "node-fetch";

const fetchMock = fetch as unknown as jest.Mock;

describe("Apify client", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    process.env.APIFY_TOKEN = "TEST_TOKEN";
  });

  it("calls actor and returns data on success", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ data: { result: "ok" } })
    });

    const client = createApifyClient();
    const res = await client.callActor("someone/actor", { foo: "bar" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/acts/someone/actor/runs?token=TEST_TOKEN"),
      expect.objectContaining({ method: "POST" })
    );
    expect(res).toEqual({ result: "ok" });
  });

  it("throws ApifyError on non-2xx", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "ServerError",
      text: async () => "failure body"
    });

    const client = createApifyClient();
    await expect(client.callTask("task-1", { foo: "bar" })).rejects.toBeInstanceOf(ApifyError);
  });
});
