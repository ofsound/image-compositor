import { useEffect, useMemo, useRef, useState } from "react";

import {
  getLayerThumbnailSignature,
  loadNormalizedAssetBitmapMap,
  renderLayerThumbnailUrl,
} from "@/lib/render-service";
import type { ProjectDocument, SourceAsset } from "@/types/project";

interface LayerThumbnailEntry {
  signature: string;
  url: string;
}

function revokeObjectUrls(urls: Record<string, string>) {
  for (const url of Object.values(urls)) {
    URL.revokeObjectURL(url);
  }
}

function revokeThumbnailEntries(entries: Record<string, LayerThumbnailEntry>) {
  revokeObjectUrls(
    Object.fromEntries(
      Object.entries(entries).map(([layerId, entry]) => [layerId, entry.url]),
    ),
  );
}

function toUrlMap(entries: Record<string, LayerThumbnailEntry>) {
  return Object.fromEntries(
    Object.entries(entries).map(([layerId, entry]) => [layerId, entry.url]),
  );
}

function getPreviousLayerEntry(
  entries: Record<string, LayerThumbnailEntry>,
  layerId: string,
  signature: string,
) {
  const previousEntry = entries[layerId];
  if (!previousEntry || previousEntry.signature !== signature) {
    return null;
  }

  return previousEntry;
}

export function useLayerThumbnailUrls({
  project,
  assets,
  width,
  height,
}: {
  project: ProjectDocument | null;
  assets: SourceAsset[];
  width: number;
  height: number;
}) {
  const entriesRef = useRef<Record<string, LayerThumbnailEntry>>({});
  const [urls, setUrls] = useState<Record<string, string>>({});
  const layerSignatures = useMemo(() => {
    if (!project) {
      return {} as Record<string, string>;
    }

    return Object.fromEntries(
      project.layers.map((layer) => [
        layer.id,
        getLayerThumbnailSignature(project, layer, assets),
      ]),
    );
  }, [assets, project]);

  useEffect(() => {
    const activeProject = project;

    if (!activeProject) {
      revokeThumbnailEntries(entriesRef.current);
      entriesRef.current = {};
      setUrls({});
      return;
    }

    let cancelled = false;

    async function run() {
      const currentProject = activeProject!;
      const previousEntries = entriesRef.current;
      const reusableEntries = Object.fromEntries(
        currentProject.layers.flatMap((layer) => {
          const signature = layerSignatures[layer.id];
          if (!signature) return [];
          const previousEntry = getPreviousLayerEntry(previousEntries, layer.id, signature);
          return previousEntry ? [[layer.id, previousEntry] as const] : [];
        }),
      ) as Record<string, LayerThumbnailEntry>;
      const layersToRender = currentProject.layers.filter((layer) => {
        const signature = layerSignatures[layer.id];
        return !signature || !getPreviousLayerEntry(previousEntries, layer.id, signature);
      });

      if (layersToRender.length === 0 && currentProject.layers.length === Object.keys(previousEntries).length) {
        return;
      }

      const bitmapMap =
        layersToRender.length > 0
          ? await loadNormalizedAssetBitmapMap(assets)
          : null;
      const renderedEntries = await Promise.all(
        layersToRender.map(async (layer) => {
          const signature = layerSignatures[layer.id]!;
          const url = await renderLayerThumbnailUrl(
            currentProject,
            layer,
            assets,
            width,
            height,
            bitmapMap ?? undefined,
          );
          return url ? [layer.id, { signature, url }] as const : null;
        }),
      );
      const nextEntries = {
        ...reusableEntries,
        ...Object.fromEntries(
          renderedEntries.filter(
            (entry): entry is readonly [string, LayerThumbnailEntry] => Boolean(entry),
          ),
        ),
      } satisfies Record<string, LayerThumbnailEntry>;

      if (cancelled) {
        revokeThumbnailEntries(
          Object.fromEntries(
            renderedEntries.filter(
              (entry): entry is readonly [string, LayerThumbnailEntry] => Boolean(entry),
            ),
          ),
        );
        return;
      }

      const retiredEntries = Object.fromEntries(
        Object.entries(previousEntries).filter(([layerId, entry]) => {
          const nextEntry = nextEntries[layerId];
          return !nextEntry || nextEntry.url !== entry.url;
        }),
      ) as Record<string, LayerThumbnailEntry>;
      entriesRef.current = nextEntries;
      setUrls(toUrlMap(nextEntries));
      revokeThumbnailEntries(retiredEntries);
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [assets, height, layerSignatures, project, width]);

  useEffect(() => {
    return () => {
      revokeThumbnailEntries(entriesRef.current);
      entriesRef.current = {};
    };
  }, []);

  return urls;
}
