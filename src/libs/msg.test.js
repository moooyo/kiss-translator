jest.mock("./browser", () => ({ browser: undefined }));

const { sendBgMsg } = require("./msg");

describe("sendBgMsg", () => {
  test("resolves safely when the runtime API is unavailable", async () => {
    await expect(sendBgMsg("runtime-action", { enabled: true })).resolves.toBe(
      undefined
    );
  });
});
