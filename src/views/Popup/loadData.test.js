const mockSendTopFrameMsg = jest.fn();
const mockSendTabMsg = jest.fn();

jest.mock("../../libs/msg", () => ({
  getCurTab: jest.fn(),
  sendTopFrameMsg: (...args) => mockSendTopFrameMsg(...args),
  sendTabMsg: (...args) => mockSendTabMsg(...args),
}));

const { MSG_TRANS_GETRULE } = require("../../config");
const { loadPopupData } = require("./loadData");

const popupData = {
  rule: { transOpen: "false" },
  setting: { darkMode: "auto" },
};

describe("loadPopupData", () => {
  beforeEach(() => {
    mockSendTopFrameMsg.mockReset();
    mockSendTabMsg.mockReset();
  });

  test("uses only the top-frame response for the default readiness probe", async () => {
    mockSendTopFrameMsg.mockResolvedValue(popupData);
    const executeScript = jest.fn();

    await expect(
      loadPopupData({ executeScript, wait: jest.fn() })
    ).resolves.toBe(popupData);

    expect(mockSendTopFrameMsg).toHaveBeenCalledWith(MSG_TRANS_GETRULE);
    expect(executeScript).not.toHaveBeenCalled();
    expect(mockSendTabMsg).not.toHaveBeenCalled();
  });

  test("returns immediately when the content script is already responsive", async () => {
    const sendMessage = jest.fn().mockResolvedValue(popupData);
    const executeScript = jest.fn();
    const wait = jest.fn();

    await expect(
      loadPopupData({ sendMessage, executeScript, wait })
    ).resolves.toBe(popupData);

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(executeScript).not.toHaveBeenCalled();
    expect(wait).not.toHaveBeenCalled();
  });

  test("retries once while the content script initializes", async () => {
    const sendMessage = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(popupData);
    const executeScript = jest.fn();
    const wait = jest.fn().mockResolvedValue(undefined);

    await expect(
      loadPopupData({ sendMessage, executeScript, wait })
    ).resolves.toBe(popupData);

    expect(wait).toHaveBeenCalledWith(80);
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(executeScript).not.toHaveBeenCalled();
    expect(mockSendTabMsg).not.toHaveBeenCalled();
  });

  test("injects content.js and retries when an open tab lost its receiver", async () => {
    const sendMessage = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(popupData);
    const executeScript = jest.fn().mockResolvedValue(undefined);
    const waitMock = jest.fn().mockResolvedValue(undefined);

    await expect(
      loadPopupData({
        sendMessage,
        getTab: jest.fn().mockResolvedValue({
          id: 17,
          url: "https://example.com/article",
        }),
        executeScript,
        wait: waitMock,
      })
    ).resolves.toBe(popupData);

    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 17, allFrames: true },
      files: ["content.js"],
    });
    expect(sendMessage).toHaveBeenCalledTimes(3);
    expect(mockSendTabMsg).not.toHaveBeenCalled();
  });

  test("does not inject scripts into browser or extension pages", async () => {
    const sendMessage = jest.fn().mockResolvedValue(undefined);
    const executeScript = jest.fn();

    await expect(
      loadPopupData({
        sendMessage,
        getTab: jest.fn().mockResolvedValue({
          id: 18,
          url: "safari-web-extension://example/options.html",
        }),
        executeScript,
        wait: jest.fn().mockResolvedValue(undefined),
      })
    ).resolves.toBeUndefined();

    expect(executeScript).not.toHaveBeenCalled();
  });

  test("finishes the normal retry sequence when content remains unavailable", async () => {
    const sendMessage = jest.fn().mockResolvedValue(undefined);
    const executeScript = jest.fn().mockResolvedValue(undefined);
    const waitMock = jest.fn().mockResolvedValue(undefined);

    await expect(
      loadPopupData({
        sendMessage,
        getTab: jest.fn().mockResolvedValue({
          id: 19,
          url: "https://example.com/article",
        }),
        executeScript,
        wait: waitMock,
      })
    ).resolves.toBeUndefined();

    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 19, allFrames: true },
      files: ["content.js"],
    });
    expect(sendMessage).toHaveBeenCalledTimes(8);
    expect(waitMock).toHaveBeenCalledTimes(7);
  });

  test("uses an enabled child after top-frame recovery is exhausted", async () => {
    const sendMessage = jest.fn().mockResolvedValue(undefined);
    const sendFallbackMessage = jest.fn().mockResolvedValue(popupData);
    const executeScript = jest.fn().mockResolvedValue(undefined);

    await expect(
      loadPopupData({
        sendMessage,
        sendFallbackMessage,
        getTab: jest
          .fn()
          .mockResolvedValue({ id: 20, url: "https://example.com" }),
        executeScript,
        wait: jest.fn(),
      })
    ).resolves.toBe(popupData);

    expect(sendMessage).toHaveBeenCalledTimes(8);
    expect(sendFallbackMessage).toHaveBeenCalledTimes(1);
    expect(sendFallbackMessage.mock.invocationCallOrder[0]).toBeGreaterThan(
      sendMessage.mock.invocationCallOrder[7]
    );
  });

  test("uses an enabled child even if reinjection is unavailable", async () => {
    mockSendTopFrameMsg.mockResolvedValue(undefined);
    mockSendTabMsg.mockResolvedValue(popupData);

    await expect(
      loadPopupData({ getTab: jest.fn(), wait: jest.fn() })
    ).resolves.toBe(popupData);

    expect(mockSendTopFrameMsg).toHaveBeenCalledTimes(2);
    expect(mockSendTabMsg).toHaveBeenCalledTimes(1);
    expect(mockSendTabMsg).toHaveBeenCalledWith(MSG_TRANS_GETRULE);
    expect(mockSendTabMsg.mock.invocationCallOrder[0]).toBeGreaterThan(
      mockSendTopFrameMsg.mock.invocationCallOrder[1]
    );
  });

  test("stops after the fallback when no frame has a receiver and reinjection is unavailable", async () => {
    const sendMessage = jest.fn().mockRejectedValue(new Error("No receiver"));
    const sendFallbackMessage = jest
      .fn()
      .mockRejectedValue(new Error("No receiver"));
    const wait = jest.fn().mockResolvedValue(undefined);

    await expect(
      loadPopupData({
        sendMessage,
        sendFallbackMessage,
        getTab: jest.fn(),
        wait,
      })
    ).resolves.toBeUndefined();

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendFallbackMessage).toHaveBeenCalledTimes(1);
    expect(wait).toHaveBeenCalledTimes(1);
  });

  test("retries incomplete data and preserves the final error response", async () => {
    const errorResponse = { error: "Page unavailable" };
    const sendMessage = jest
      .fn()
      .mockResolvedValueOnce({ rule: {} })
      .mockResolvedValueOnce(errorResponse);

    await expect(
      loadPopupData({ sendMessage, getTab: jest.fn(), wait: jest.fn() })
    ).resolves.toBe(errorResponse);

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(mockSendTabMsg).not.toHaveBeenCalled();
  });

  test("preserves explicit top-frame errors instead of accepting child data", async () => {
    const response = { error: "Page unavailable" };
    mockSendTopFrameMsg.mockResolvedValue(response);
    mockSendTabMsg.mockResolvedValue(popupData);

    await expect(
      loadPopupData({ getTab: jest.fn(), wait: jest.fn() })
    ).resolves.toBe(response);

    expect(mockSendTabMsg).not.toHaveBeenCalled();
  });

  test("ignores incomplete child-frame data", async () => {
    mockSendTopFrameMsg.mockResolvedValue(undefined);
    mockSendTabMsg.mockResolvedValue({ rule: {} });

    await expect(
      loadPopupData({ getTab: jest.fn(), wait: jest.fn() })
    ).resolves.toBeUndefined();
  });
});
