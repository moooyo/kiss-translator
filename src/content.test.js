const mockRun = jest.fn();

jest.mock("./common", () => ({
  run: (...args) => mockRun(...args),
}));

jest.mock("./libs/browser", () => ({
  browser: {
    runtime: {
      getURL: () => "chrome-extension://test-id/",
    },
  },
}));

describe("content runtime marker", () => {
  const marker = "__KISS_CONTENT_RUNTIME__chrome-extension://test-id/";

  beforeEach(() => {
    jest.resetModules();
    mockRun.mockReset();
    delete globalThis[marker];
  });

  afterEach(() => {
    delete globalThis[marker];
  });

  test("clears the marker after startup rejects", async () => {
    mockRun.mockRejectedValueOnce(new Error("startup failed"));

    require("./content");
    await Promise.resolve();
    await Promise.resolve();

    expect(globalThis[marker]).toBeUndefined();
  });
});
