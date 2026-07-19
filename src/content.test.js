const mockRun = jest.fn();
const mockGetURL = jest.fn();

jest.mock("./common", () => ({
  run: (...args) => mockRun(...args),
}));

jest.mock("./libs/browser", () => ({
  browser: {
    runtime: {
      getURL: (...args) => mockGetURL(...args),
    },
  },
  isExtensionContextInvalidatedError: (error) =>
    error?.message?.includes("Extension context invalidated") === true,
}));

describe("content runtime marker", () => {
  const marker = "__KISS_CONTENT_RUNTIME__chrome-extension://test-id/";

  beforeEach(() => {
    jest.resetModules();
    mockRun.mockReset();
    mockGetURL.mockReset();
    mockGetURL.mockReturnValue("chrome-extension://test-id/");
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

  test("does not start when the extension context is already invalid", () => {
    mockGetURL.mockImplementationOnce(() => {
      throw new Error("Extension context invalidated.");
    });

    expect(() => require("./content")).not.toThrow();
    expect(mockRun).not.toHaveBeenCalled();
  });

  test("does not report an invalidated startup as an uncaught failure", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation();
    mockRun.mockRejectedValueOnce(new Error("Extension context invalidated."));

    require("./content");
    await Promise.resolve();
    await Promise.resolve();

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
