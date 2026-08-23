import { act } from "react";
import { createRoot } from "react-dom/client";
import DraggableResizable from "./DraggableResizable";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../libs/mobile", () => ({ isMobile: false }));

const emptyRect = {
  x: 0,
  y: 0,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  width: 0,
  height: 0,
  toJSON: () => ({}),
};

describe("DraggableResizable auto height bounds", () => {
  let container;
  let root;
  let outerHeight;
  let resizeCallback;
  let getBoundingClientRect;
  let originalResizeObserver;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    outerHeight = 100;
    originalResizeObserver = window.ResizeObserver;
    window.ResizeObserver = class {
      constructor(callback) {
        resizeCallback = callback;
      }

      observe() {}

      disconnect() {}
    };
    HTMLElement.prototype.setPointerCapture = jest.fn();
    getBoundingClientRect = jest
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function () {
        if (this.classList?.contains("KT-draggable")) {
          return { ...emptyRect, height: outerHeight, bottom: outerHeight };
        }
        return emptyRect;
      });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 500,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    getBoundingClientRect.mockRestore();
    window.ResizeObserver = originalResizeObserver;
  });

  function renderPanel(props = {}) {
    const defaults = {
      position: { x: 0, y: 0 },
      size: { w: 320, h: 400 },
      minSize: { w: 100, h: 100 },
      maxSize: { w: 800, h: 800 },
      setSize: jest.fn(),
      setPosition: jest.fn(),
      autoHeight: true,
      header: <span>header</span>,
      children: <div>content</div>,
    };

    const panel = { ...defaults, ...props };
    act(() => root.render(<DraggableResizable {...panel} />));
    return panel;
  }

  test("allows a short auto-height panel to reach the viewport bottom", () => {
    const panel = renderPanel();
    panel.setPosition.mockClear();
    const header = container.querySelector(".KT-draggable-header");

    act(() => {
      header.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true, clientX: 0, clientY: 0 })
      );
    });
    act(() => {
      header.dispatchEvent(
        new MouseEvent("pointermove", {
          bubbles: true,
          clientX: 0,
          clientY: 1000,
        })
      );
    });

    expect(panel.setPosition).toHaveBeenLastCalledWith({ x: 0, y: 400 });
  });

  test("clamps the position when auto-height content grows", () => {
    const panel = renderPanel({ position: { x: 0, y: 400 } });
    panel.setPosition.mockClear();
    outerHeight = 300;

    act(() => resizeCallback());

    const updater = panel.setPosition.mock.calls.at(-1)[0];
    expect(updater({ x: 0, y: 400 })).toEqual({ x: 0, y: 200 });
  });

  // header 同时是拖拽触发区，里面坐着一排图标按钮和一个溢出菜单。
  // 没有这条护栏，点开菜单的同时整个框会跟着指针跑。
  test("pressing a control inside the header does not start a drag", () => {
    const panel = renderPanel({
      header: (
        <span>
          <button type="button">more</button>
        </span>
      ),
    });
    panel.setPosition.mockClear();
    const header = container.querySelector(".KT-draggable-header");
    const button = header.querySelector("button");

    act(() => {
      button.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true, clientX: 0, clientY: 0 })
      );
    });
    act(() => {
      header.dispatchEvent(
        new MouseEvent("pointermove", {
          bubbles: true,
          clientX: 0,
          clientY: 200,
        })
      );
    });

    expect(panel.setPosition).not.toHaveBeenCalled();
  });

  // pointercancel 之后浏览器不会再补发 pointerup，而清空 origin 的唯一出口
  // 就在 pointerup 里。少了 cancel 分支，被系统手势打断的一次拖拽会让 origin
  // 永久残留，之后指针只要掠过 header 就继续拖动——没有按下任何键。
  test("a cancelled pointer ends the drag instead of leaving it stuck", () => {
    const panel = renderPanel();
    const header = container.querySelector(".KT-draggable-header");

    act(() => {
      header.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true, clientX: 0, clientY: 0 })
      );
    });
    act(() => {
      header.dispatchEvent(new MouseEvent("pointercancel", { bubbles: true }));
    });

    panel.setPosition.mockClear();
    act(() => {
      header.dispatchEvent(
        new MouseEvent("pointermove", {
          bubbles: true,
          clientX: 0,
          clientY: 200,
        })
      );
    });

    expect(panel.setPosition).not.toHaveBeenCalled();
  });
});
