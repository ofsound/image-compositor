import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SortableLayerRow } from "@/components/app/sortable-layer-row";
import { createProjectDocument } from "@/lib/project-defaults";

const useSortableMock = vi.fn();

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => useSortableMock(),
}));

describe("SortableLayerRow", () => {
  it("keeps dragged layer rows vertically aligned while sorting", () => {
    const project = createProjectDocument("Layer Row");
    const layer = project.layers[0]!;

    useSortableMock.mockReturnValue({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: { x: 48, y: 24, scaleX: 1, scaleY: 1 },
      transition: undefined,
      isDragging: true,
    });

    render(
      <SortableLayerRow
        layer={layer}
        isSelected={false}
        thumbnailUrl={null}
        canDelete
        onSelect={vi.fn()}
        onToggleVisibility={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const row = screen.getByLabelText(`Reorder ${layer.name}`).closest(".border");

    expect(row).toHaveStyle({
      transform: "translate3d(0px, 24px, 0) scaleX(1) scaleY(1)",
    });
  });
});
