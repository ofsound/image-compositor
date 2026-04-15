import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface EditableSliderValueProps {
  value: string;
  inputLabel: string;
  disabled?: boolean;
  onCommit?: (value: string) => void;
  className?: string;
}

export function EditableSliderValue({
  value,
  inputLabel,
  disabled = false,
  onCommit,
  className,
}: EditableSliderValueProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelBlurCommitRef = useRef(false);

  useEffect(() => {
    if (!isEditing) {
      setDraftValue(value);
    }
  }, [isEditing, value]);

  useEffect(() => {
    if (!isEditing) return;

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing]);

  const commit = () => {
    cancelBlurCommitRef.current = false;
    onCommit?.(draftValue);
    setIsEditing(false);
  };

  const cancel = () => {
    cancelBlurCommitRef.current = true;
    setDraftValue(value);
    setIsEditing(false);
  };

  if (!onCommit || disabled) {
    return (
      <span className={cn("font-mono text-[10px] text-text-muted", className)}>
        {value}
      </span>
    );
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        aria-label={inputLabel}
        value={draftValue}
        className={cn(
          "h-7 w-20 px-2 text-right font-mono text-[10px] text-text",
          className,
        )}
        onBlur={() => {
          if (cancelBlurCommitRef.current) {
            cancelBlurCommitRef.current = false;
            return;
          }

          commit();
        }}
        onChange={(event) => setDraftValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
            return;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "rounded-md px-2 py-1 font-mono text-[10px] text-text-muted transition-colors hover:bg-surface-sunken/70 hover:text-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-focus",
        className,
      )}
      aria-label={`Edit ${inputLabel}`}
      onClick={() => {
        cancelBlurCommitRef.current = false;
        setIsEditing(true);
      }}
    >
      {value}
    </button>
  );
}
