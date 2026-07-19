import { act } from "react";
import { createRoot } from "react-dom/client";
import { AlertProvider, useAlert } from "./Alert";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockSnackbarMountCount = 0;

jest.mock("@mui/material/Snackbar", () => {
  return function MockSnackbar({ open, children }) {
    const ReactApi = jest.requireActual("react");
    const mountId = ReactApi.useRef(++mockSnackbarMountCount).current;
    return open
      ? ReactApi.createElement(
          "div",
          { "data-testid": "snackbar", "data-mount-id": mountId },
          children
        )
      : null;
  };
});

jest.mock("@mui/material/Alert", () => {
  return function MockAlert({ children }) {
    return jest.requireActual("react").createElement("div", null, children);
  };
});

describe("AlertProvider", () => {
  test("remounts the snackbar for consecutive alerts", () => {
    let alertApi;
    const container = document.createElement("div");
    const root = createRoot(container);

    function Harness() {
      alertApi = useAlert();
      return null;
    }

    act(() => {
      root.render(
        <AlertProvider>
          <Harness />
        </AlertProvider>
      );
    });

    act(() => alertApi.info("First"));
    const firstMountId = container
      .querySelector('[data-testid="snackbar"]')
      .getAttribute("data-mount-id");

    act(() => alertApi.success("Second"));
    const secondSnackbar = container.querySelector('[data-testid="snackbar"]');

    expect(secondSnackbar.textContent).toBe("Second");
    expect(secondSnackbar.getAttribute("data-mount-id")).not.toBe(firstMountId);

    act(() => root.unmount());
  });
});
