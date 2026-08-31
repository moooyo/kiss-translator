import { createLoadingSVG, createRetrySVG, loadingSvg } from "./svg";

test("marks shared loading artwork as decorative", () => {
  const icon = createLoadingSVG();

  expect(icon.getAttribute("aria-hidden")).toBe("true");
  expect(icon.getAttribute("focusable")).toBe("false");
  expect(loadingSvg).toContain('aria-hidden="true"');
  expect(loadingSvg).toContain('focusable="false"');
});

test("keeps the retry icon equally visible for pointer and keyboard focus", () => {
  const icon = createRetrySVG();

  expect(icon.style.opacity).toBe("0.7");
  expect(icon.style.transition).toContain("opacity");

  icon.dispatchEvent(new FocusEvent("focus"));
  expect(icon.style.opacity).toBe("1");
  icon.dispatchEvent(new FocusEvent("blur"));
  expect(icon.style.opacity).toBe("0.7");

  icon.dispatchEvent(new MouseEvent("mouseenter"));
  expect(icon.style.opacity).toBe("1");
  icon.dispatchEvent(new MouseEvent("mouseleave"));
  expect(icon.style.opacity).toBe("0.7");
});
