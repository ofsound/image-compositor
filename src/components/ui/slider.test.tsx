import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Slider } from "@/components/ui/slider";

describe("Slider", () => {
  it("does not emit value changes when disabled", () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <Slider
        aria-label="Disabled slider"
        min={0}
        max={10}
        step={1}
        value={[5]}
        disabled
        onValueChange={onValueChange}
      />,
    );

    const thumb = container.querySelector('[role="slider"]');
    expect(thumb).not.toBeNull();

    fireEvent.keyDown(thumb as Element, { key: "ArrowRight" });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("emits value changes when enabled", () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <Slider
        aria-label="Enabled slider"
        min={0}
        max={10}
        step={1}
        value={[5]}
        onValueChange={onValueChange}
      />,
    );

    const thumb = container.querySelector('[role="slider"]');
    expect(thumb).not.toBeNull();

    fireEvent.keyDown(thumb as Element, { key: "ArrowRight" });

    expect(onValueChange).toHaveBeenCalledWith([6]);
  });
});
