const mockQuery = jest.fn();
const mockSendMessage = jest.fn();
const mockRuntimeSendMessage = jest.fn();

jest.mock("./browser", () => ({
  browser: {
    runtime: {
      sendMessage: (...args) => mockRuntimeSendMessage(...args),
    },
    tabs: {
      query: (...args) => mockQuery(...args),
      sendMessage: (...args) => mockSendMessage(...args),
    },
  },
  isExtensionContextInvalidatedError: (error) =>
    (error?.message || "").includes("Extension context invalidated"),
}));

const { getCurTab, sendBgMsg, sendTabMsg, sendTopFrameMsg } = require("./msg");

const invalidated = () => new Error("Extension context invalidated.");

describe("tab messaging targets", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue([{ id: 17 }]);
    mockSendMessage.mockReset();
    mockSendMessage.mockResolvedValue({ ok: true });
    mockRuntimeSendMessage.mockReset();
    mockRuntimeSendMessage.mockResolvedValue({ ok: true });
  });

  test("broadcasts ordinary tab messages with the existing behavior", async () => {
    await sendTabMsg("toggle", { enabled: true });

    expect(mockSendMessage).toHaveBeenCalledWith(17, {
      action: "toggle",
      args: { enabled: true },
    });
  });

  test("targets frame zero when a top-frame response is required", async () => {
    await sendTopFrameMsg("get-rule");

    expect(mockSendMessage).toHaveBeenCalledWith(
      17,
      { action: "get-rule", args: undefined },
      { frameId: 0 }
    );
  });

  test("relays the background response", async () => {
    await expect(sendBgMsg("sha256", { text: "a" })).resolves.toEqual({
      ok: true,
    });
    expect(mockRuntimeSendMessage).toHaveBeenCalledWith({
      action: "sha256",
      args: { text: "a" },
    });
  });

  // 扩展重载后遗留在页面里的旧上下文会持续调用这几个入口，而 translator.js 的
  // MSG_UPDATE_ICON 等调用点是即发即忘的，不吞掉就是一串 unhandled rejection。
  test.each([
    ["sendBgMsg", () => sendBgMsg("update_icon", true)],
    ["getCurTab", () => getCurTab()],
    ["sendTabMsg", () => sendTabMsg("toggle")],
  ])("%s resolves to undefined on an invalidated context", async (_, call) => {
    mockRuntimeSendMessage.mockRejectedValue(invalidated());
    mockQuery.mockRejectedValue(invalidated());
    mockSendMessage.mockRejectedValue(invalidated());

    await expect(call()).resolves.toBeUndefined();
  });

  test.each([
    ["sendBgMsg", () => sendBgMsg("update_icon", true), mockRuntimeSendMessage],
    ["getCurTab", () => getCurTab(), mockQuery],
  ])("%s still propagates unrelated failures", async (_, call, mock) => {
    mock.mockRejectedValue(new Error("boom"));

    await expect(call()).rejects.toThrow("boom");
  });
});
