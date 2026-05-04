import { fireEvent, render } from "@testing-library/react";
import { useState, type ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { Slider } from "@/components/ui/slider";

const SLIDER_RECT = {
  bottom: 10,
  height: 10,
  left: 0,
  right: 100,
  top: 0,
  width: 100,
  x: 0,
  y: 0,
  toJSON: () => ({}),
} satisfies DOMRect;

function ControlledSlider({
  initialValue,
  onValueChange,
  onValueCommit,
  ...props
}: Omit<ComponentProps<typeof Slider>, "value"> & {
  initialValue: number;
}) {
  const [value, setValue] = useState([initialValue]);

  return (
    <Slider
      {...props}
      value={value}
      onValueChange={(nextValue) => {
        setValue(nextValue);
        onValueChange?.(nextValue);
      }}
      onValueCommit={onValueCommit}
    />
  );
}

function renderSlider(
  props: Omit<ComponentProps<typeof Slider>, "value"> & {
    initialValue?: number;
  } = {},
) {
  const onValueChange = vi.fn();
  const onValueCommit = vi.fn();
  const { container } = render(
    <ControlledSlider
      aria-label="Test slider"
      initialValue={props.initialValue ?? 0.5}
      max={props.max ?? 1}
      min={props.min ?? 0}
      onValueChange={onValueChange}
      onValueCommit={onValueCommit}
      step={props.step ?? 0.01}
      {...props}
    />,
  );

  const root = container.firstElementChild;
  const thumb = container.querySelector('[role="slider"]');

  expect(root).not.toBeNull();
  expect(thumb).not.toBeNull();

  const resolvedRoot = root as HTMLElement;
  const resolvedThumb = thumb as HTMLElement;

  Object.defineProperty(resolvedRoot, "getBoundingClientRect", {
    configurable: true,
    value: () => SLIDER_RECT,
  });

  return {
    onValueChange,
    onValueCommit,
    root: resolvedRoot,
    thumb: resolvedThumb,
  };
}

describe("Slider", () => {
  it("does not emit value changes when disabled", () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <Slider
        aria-label="Disabled slider"
        disabled
        max={10}
        min={0}
        onValueChange={onValueChange}
        step={1}
        value={[5]}
      />,
    );

    const thumb = container.querySelector('[role="slider"]');
    expect(thumb).not.toBeNull();

    fireEvent.keyDown(thumb as Element, { key: "ArrowRight" });
    fireEvent.pointerDown(thumb as Element, {
      button: 0,
      clientX: 50,
      pointerId: 1,
    });
    fireEvent.pointerMove(window, { clientX: 70, pointerId: 1 });
    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("emits value changes when enabled", () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <Slider
        aria-label="Enabled slider"
        max={10}
        min={0}
        onValueChange={onValueChange}
        step={1}
        value={[5]}
      />,
    );

    const thumb = container.querySelector('[role="slider"]');
    expect(thumb).not.toBeNull();

    fireEvent.keyDown(thumb as Element, { key: "ArrowRight" });

    expect(onValueChange).toHaveBeenCalledWith([6]);
  });

  it("keeps shift plus arrow key coarse stepping unchanged", () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <Slider
        aria-label="Keyboard slider"
        max={20}
        min={0}
        onValueChange={onValueChange}
        step={1}
        value={[5]}
      />,
    );

    const thumb = container.querySelector('[role="slider"]');
    expect(thumb).not.toBeNull();

    fireEvent.keyDown(thumb as Element, { key: "ArrowRight", shiftKey: true });

    expect(onValueChange).toHaveBeenCalledWith([15]);
  });

  it("uses full sensitivity during normal pointer drags", () => {
    const { onValueChange, onValueCommit, thumb } = renderSlider();

    fireEvent.pointerDown(thumb, {
      button: 0,
      clientX: 50,
      pointerId: 1,
    });
    fireEvent.pointerMove(window, {
      clientX: 60,
      pointerId: 1,
    });
    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(onValueChange).toHaveBeenCalledWith([0.6]);
    expect(onValueCommit).toHaveBeenCalledWith([0.6]);
  });

  it("reduces pointer drag sensitivity while shift is held", () => {
    const { onValueChange, onValueCommit, thumb } = renderSlider();

    fireEvent.pointerDown(thumb, {
      button: 0,
      clientX: 50,
      pointerId: 1,
      shiftKey: true,
    });
    fireEvent.pointerMove(window, {
      clientX: 60,
      pointerId: 1,
      shiftKey: true,
    });
    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(onValueChange).toHaveBeenCalledWith([0.51]);
    expect(onValueCommit).toHaveBeenCalledWith([0.51]);
  });

  it("re-anchors when shift is toggled during a drag so the value does not jump", () => {
    const { onValueChange, onValueCommit, thumb } = renderSlider();

    fireEvent.pointerDown(thumb, {
      button: 0,
      clientX: 50,
      pointerId: 1,
    });
    fireEvent.pointerMove(window, {
      clientX: 60,
      pointerId: 1,
    });
    expect(onValueChange).toHaveBeenLastCalledWith([0.6]);

    fireEvent.pointerMove(window, {
      clientX: 70,
      pointerId: 1,
      shiftKey: true,
    });
    expect(onValueChange).toHaveBeenCalledTimes(1);

    fireEvent.pointerMove(window, {
      clientX: 80,
      pointerId: 1,
      shiftKey: true,
    });
    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(onValueChange).toHaveBeenLastCalledWith([0.61]);
    expect(onValueCommit).toHaveBeenCalledWith([0.61]);
  });

  it("snaps to the clicked position when dragging starts from the track", () => {
    const { onValueChange, onValueCommit, root } = renderSlider();

    fireEvent.pointerDown(root, {
      button: 0,
      clientX: 80,
      pointerId: 1,
    });
    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(onValueChange).toHaveBeenCalledWith([0.8]);
    expect(onValueCommit).toHaveBeenCalledWith([0.8]);
  });

  it("resets to the supplied default value on double click", () => {
    const { onValueChange, onValueCommit, root } = renderSlider({
      defaultValue: [0.25],
      initialValue: 0.8,
    });

    fireEvent.doubleClick(root);

    expect(onValueChange).toHaveBeenCalledWith([0.25]);
    expect(onValueCommit).toHaveBeenCalledWith([0.25]);
  });

  it("ignores double click when no default value is supplied", () => {
    const { onValueChange, onValueCommit, root } = renderSlider({
      initialValue: 0.8,
    });

    fireEvent.doubleClick(root);

    expect(onValueChange).not.toHaveBeenCalled();
    expect(onValueCommit).not.toHaveBeenCalled();
  });
});
