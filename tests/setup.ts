import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, vi } from "vitest";

beforeAll(() => {
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  vi.stubGlobal("ResizeObserver", ResizeObserver);

  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.getBoundingClientRect = () => ({
    width: 100,
    height: 40,
    top: 0,
    left: 0,
    bottom: 40,
    right: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
});

afterEach(() => {
  cleanup();
  // Sheet/drawer tests can leave scroll-lock styles that hide later queries.
  document.body.style.overflow = "";
  document.body.removeAttribute("data-scroll-locked");
});
