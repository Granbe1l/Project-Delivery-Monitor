import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Evidence, Metric } from "./App";
import { age, timestamp } from "./api";
afterEach(cleanup);
describe("Honest evidence presentation", () => {
  it("distinguishes unknown metrics from observed zero", () => {
    const { rerender } = render(
      <Metric label="Open issues" value={null} help="Collected scope" />,
    );
    expect(screen.getByText("Data unavailable")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    rerender(<Metric label="Open issues" value={0} help="Collected scope" />);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("In collected records")).toBeInTheDocument();
  });
  it("rejects unsafe evidence links", () => {
    render(<Evidence url="https://github.com.evil.test/a" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("opens genuine GitHub evidence safely", () => {
    render(<Evidence url="https://github.com/streamlit/streamlit/issues/1" />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
  });
  it("measures age at observation instead of today", () => {
    expect(age("2026-01-01T00:00:00Z", "2026-01-15T00:00:00Z")).toBe(14);
    expect(age(undefined, null)).toBeNull();
    expect(timestamp(null)).toBe("Not yet observed");
  });
});

it("converts observation timestamps to WIB across the date boundary", () => {
  expect(timestamp("2026-11-10T22:59:00Z")).toBe("11 Nov 2026, 05:59 WIB");
});
