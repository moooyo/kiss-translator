let mockBrowser;

jest.mock("./browser", () => ({
  get browser() {
    return mockBrowser;
  },
  isExtensionContextInvalidatedError: (error) =>
    error?.message?.includes("Extension context invalidated") === true,
}));

const { sendBgMsg, sendTabMsg } = require("./msg");

describe("extension messaging", () => {
  beforeEach(() => {
    mockBrowser = undefined;
  });

  test("resolves safely when the runtime API is unavailable", async () => {
    await expect(sendBgMsg("runtime-action", { enabled: true })).resolves.toBe(
      undefined
    );
  });

  test("swallows invalidated runtime errors from fire-and-forget messages", async () => {
    mockBrowser = {
      runtime: {
        sendMessage: jest
          .fn()
          .mockRejectedValue(new Error("Extension context invalidated.")),
      },
    };

    await expect(sendBgMsg("runtime-action")).resolves.toBeUndefined();
  });

  test("keeps unrelated runtime failures observable", async () => {
    const error = new Error("permission denied");
    mockBrowser = {
      runtime: { sendMessage: jest.fn().mockRejectedValue(error) },
    };

    await expect(sendBgMsg("runtime-action")).rejects.toBe(error);
  });

  test("swallows invalidated context errors while messaging a tab", async () => {
    mockBrowser = {
      tabs: {
        query: jest.fn().mockResolvedValue([{ id: 7 }]),
        sendMessage: jest
          .fn()
          .mockRejectedValue(new Error("Extension context invalidated.")),
      },
    };

    await expect(sendTabMsg("tab-action")).resolves.toBeUndefined();
  });
});
