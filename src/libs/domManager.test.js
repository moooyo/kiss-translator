/* eslint-disable testing-library/no-container, testing-library/no-unnecessary-act */
import { act } from "react";
import DomManager from "./domManager";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test("preserves managed close behavior across prop updates", async () => {
  const onClose = jest.fn();
  const rootElement = document.createElement("div");
  document.body.appendChild(rootElement);

  function Probe({ label, onClose: close }) {
    return (
      <button type="button" onClick={close}>
        {label}
      </button>
    );
  }

  const manager = new DomManager({
    id: "managed-test",
    reactComponent: Probe,
    rootElement,
    props: { label: "initial", onClose },
  });

  await act(async () => {
    manager.show();
    await Promise.resolve();
  });
  await act(async () => {
    manager.updateProps({ label: "updated" });
    await Promise.resolve();
  });

  const host = rootElement.querySelector("#managed-test");
  const button = host.querySelector("button");
  expect(button.textContent).toBe("updated");

  act(() => button.click());
  expect(host.style.display).toBe("none");
  expect(onClose).toHaveBeenCalledTimes(1);

  await act(async () => {
    manager.show({ label: "reopened" });
    await Promise.resolve();
  });
  expect(host.style.display).toBe("");
  expect(host.querySelector("button").textContent).toBe("reopened");

  act(() => manager.destroy());
  rootElement.remove();
});
