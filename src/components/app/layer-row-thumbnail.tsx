export function LayerRowThumbnail({
  layerId,
  layerName,
  thumbnailUrl,
}: {
  layerId: string;
  layerName: string;
  thumbnailUrl: string | null;
}) {
  return thumbnailUrl ? (
    <img
      src={thumbnailUrl}
      alt={`${layerName} preview`}
      data-testid={`layer-thumbnail-${layerId}`}
      className="h-32 w-full rounded-md border border-border-subtle bg-preview-canvas object-contain"
    />
  ) : (
    <div
      data-testid={`layer-thumbnail-placeholder-${layerId}`}
      className="flex h-32 w-full items-center justify-center rounded-md border border-border-subtle bg-preview-canvas font-mono text-[9px] uppercase tracking-[0.08em] text-text-faint"
    >
      Loading
    </div>
  );
}
