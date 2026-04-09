import { useEffect } from "react";

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

export function useHistoryShortcuts({
  busy,
  canUndo,
  canRedo,
  undo,
  redo,
}: {
  busy: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((!event.metaKey && !event.ctrlKey) || isEditableTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      const wantsUndo = key === "z" && !event.shiftKey;
      const wantsRedo = (key === "z" && event.shiftKey) || key === "y";

      if (wantsUndo && canUndo && !busy) {
        event.preventDefault();
        void undo();
        return;
      }

      if (wantsRedo && canRedo && !busy) {
        event.preventDefault();
        void redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, canRedo, canUndo, redo, undo]);
}
