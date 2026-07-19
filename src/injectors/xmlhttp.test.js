import { XMLHttpRequestInjector } from "./xmlhttp";

describe("XMLHttpRequestInjector", () => {
  const stateKey = "__KISS_TRANSLATOR_XHR_INTERCEPTOR__";
  let originalXMLHttpRequest;

  beforeEach(() => {
    originalXMLHttpRequest = global.XMLHttpRequest;
    delete globalThis[stateKey];
    document.documentElement.removeAttribute("data-kiss-subtitle-interceptor");
  });

  afterEach(() => {
    delete globalThis[stateKey];
    global.XMLHttpRequest = originalXMLHttpRequest;
  });

  test("stops intercepting while the subtitle runtime is disabled", () => {
    const originalOpen = jest.fn();
    class MockXMLHttpRequest {
      addEventListener = jest.fn();
    }
    MockXMLHttpRequest.prototype.open = originalOpen;
    global.XMLHttpRequest = MockXMLHttpRequest;

    XMLHttpRequestInjector();

    const enabledRequest = new MockXMLHttpRequest();
    enabledRequest.open("GET", "https://youtube.test/timedtext");
    expect(enabledRequest.addEventListener).toHaveBeenCalledWith(
      "load",
      expect.any(Function)
    );

    document.documentElement.setAttribute(
      "data-kiss-subtitle-interceptor",
      "disabled"
    );
    const disabledRequest = new MockXMLHttpRequest();
    disabledRequest.open("GET", "https://youtube.test/timedtext");
    expect(disabledRequest.addEventListener).not.toHaveBeenCalled();
    expect(originalOpen).toHaveBeenCalledTimes(2);
  });

  test("installs only one wrapper", () => {
    class MockXMLHttpRequest {}
    MockXMLHttpRequest.prototype.open = jest.fn();
    global.XMLHttpRequest = MockXMLHttpRequest;

    XMLHttpRequestInjector();
    const installedOpen = MockXMLHttpRequest.prototype.open;
    XMLHttpRequestInjector();

    expect(MockXMLHttpRequest.prototype.open).toBe(installedOpen);
  });
});
