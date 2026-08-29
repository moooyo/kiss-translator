/* eslint-disable testing-library/no-container, testing-library/no-unnecessary-act */
import { act } from "react";
import { createRoot } from "react-dom/client";
import TranBtn from "./TranBtn";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../libs/mobile", () => ({ isMobile: false }));

test("keeps the selection FAB inside its themed render root", () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <TranBtn
        position={{ x: 20, y: 30 }}
        btnEvent="onMouseUp"
        onTrigger={jest.fn()}
      />
    );
  });

  const button = container.querySelector(".KT-tranbtn");
  expect(button).not.toBeNull();
  expect(button.parentElement).toBe(container);
  expect(button.style.position).toBe("fixed");
  expect(button.style.left).toBe("20px");
  expect(button.style.top).toBe("30px");

  act(() => root.unmount());
  container.remove();
});
