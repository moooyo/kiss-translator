import { act } from "react";
import { createRoot } from "react-dom/client";
import { useSubtitleStyleEditor } from "./useSubtitleStyleEditor";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("useSubtitleStyleEditor", () => {
  const originalRequestAnimationFrame = global.requestAnimationFrame;
  const originalCancelAnimationFrame = global.cancelAnimationFrame;

  beforeEach(() => {
    jest.useFakeTimers();
    global.requestAnimationFrame = (callback) => setTimeout(callback, 0);
    global.cancelAnimationFrame = clearTimeout;
  });

  afterEach(() => {
    jest.useRealTimers();
    global.requestAnimationFrame = originalRequestAnimationFrame;
    global.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  test("flushes the latest pending style when the editor unmounts", () => {
    const updateSubtitle = jest.fn();
    let editor;
    const root = createRoot(document.createElement("div"));
    function Harness() {
      editor = useSubtitleStyleEditor({
        originStyle: "color: white;",
        translationStyle: "color: blue;",
        windowStyle: "background-color: black;",
        updateSubtitle,
      });
      return null;
    }

    act(() => root.render(<Harness />));
    act(() => editor.updateOriginCss("font-weight", "700"));
    act(() => root.unmount());

    expect(updateSubtitle).toHaveBeenCalledWith({
      originStyle: expect.stringContaining("font-weight: 700"),
    });
  });
});
