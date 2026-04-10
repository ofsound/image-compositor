import { useEffect, useState } from "react";
import { readBlob } from "@/lib/opfs";

export function useObjectUrl(path: string | null, versionKey?: string) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    async function run() {
      if (!path) {
        setUrl(null);
        return;
      }

      const blob = await readBlob(path);
      if (!blob || !active) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }

    void run();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, versionKey]);

  return url;
}

export function SourceThumbnail({
  previewPath,
  label,
  versionKey,
  compact = false,
}: {
  previewPath: string;
  label: string;
  versionKey: string;
  compact?: boolean;
}) {
  const previewUrl = useObjectUrl(previewPath, versionKey);

  return previewUrl ? (
    <img
      src={previewUrl}
      alt={label}
      className={
        compact
          ? "h-24 w-full rounded-md object-cover"
          : "h-20 w-full rounded-md object-cover"
      }
    />
  ) : (
    <div
      className={
        compact
          ? "flex h-24 items-center justify-center rounded-md bg-surface-muted font-mono text-[10px] uppercase tracking-[0.1em] text-text-faint"
          : "flex h-20 items-center justify-center rounded-md bg-surface-muted font-mono text-[10px] uppercase tracking-[0.1em] text-text-faint"
      }
    >
      Loading
    </div>
  );
}
