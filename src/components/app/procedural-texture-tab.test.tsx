import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { formatPercentValue } from "@/lib/format-utils";
import { SliderField } from "./procedural-texture-tab";

describe("SliderField", () => {
  it("allows formatted manual entry and focuses the inline input", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SliderField
        label="Opacity"
        min={0}
        max={1}
        step={0.01}
        value={0.5}
        formatter={formatPercentValue}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit Opacity value" }));

    const input = screen.getByRole("textbox", { name: "Opacity value" });
    expect(input).toHaveFocus();

    await user.clear(input);
    await user.type(input, "25%");
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith(0.25);
    expect(screen.queryByRole("textbox", { name: "Opacity value" })).toBeNull();
  });

  it("snaps and clamps committed values", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const { rerender } = render(
      <SliderField
        label="Opacity"
        min={0}
        max={1}
        step={0.05}
        value={0.4}
        formatter={formatPercentValue}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit Opacity value" }));
    const input = screen.getByRole("textbox", { name: "Opacity value" });
    await user.clear(input);
    await user.type(input, "63%");
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith(0.65);

    rerender(
      <SliderField
        label="Opacity"
        min={0}
        max={1}
        step={0.05}
        value={0.65}
        formatter={formatPercentValue}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit Opacity value" }));
    const secondInput = screen.getByRole("textbox", { name: "Opacity value" });
    await user.clear(secondInput);
    await user.type(secondInput, "250%");
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it("restores the current value when manual input is invalid", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SliderField
        label="Opacity"
        min={0}
        max={1}
        step={0.01}
        value={0.5}
        formatter={formatPercentValue}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit Opacity value" }));
    const input = screen.getByRole("textbox", { name: "Opacity value" });
    await user.clear(input);
    await user.type(input, "nope");
    await user.tab();

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "Opacity value" })).toBeNull();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("cancels manual entry on escape", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SliderField
        label="Opacity"
        min={0}
        max={1}
        step={0.01}
        value={0.5}
        formatter={formatPercentValue}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit Opacity value" }));
    const input = screen.getByRole("textbox", { name: "Opacity value" });
    await user.clear(input);
    await user.type(input, "25%");
    await user.keyboard("{Escape}");

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "Opacity value" })).toBeNull();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("leaves semantic slider labels read-only", () => {
    render(
      <SliderField
        label="Split Bias"
        min={0}
        max={1}
        step={0.01}
        value={0.5}
        formatter={(value) => {
          if (value < 0.45) return "horizontal";
          if (value > 0.55) return "vertical";
          return "balanced";
        }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Edit Split Bias value" })).toBeNull();
    expect(screen.getByText("balanced")).toBeInTheDocument();
  });

  it("does not allow manual entry when disabled", () => {
    render(
      <SliderField
        label="Opacity"
        min={0}
        max={1}
        step={0.01}
        value={0.5}
        disabled
        formatter={formatPercentValue}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Edit Opacity value" })).toBeNull();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });
});
