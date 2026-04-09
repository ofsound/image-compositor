import { useEffect, useRef, useState } from "react";

import { renderLayerThumbnailUrls } from "@/lib/render-service";
import type { ProjectDocument, SourceAsset } from "@/types/project";

function revokeObjectUrls(urls: Record<string, string>) {
  for (const url of Object.values(urls)) {
    URL.revokeObjectURL(url);
  }
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
  const urlsRef = useRef<Record<string, string>>({});
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const activeProject = project;

    if (!activeProject) {
      revokeObjectUrls(urlsRef.current);
      urlsRef.current = {};
      setUrls({});
      return;
    }

    let cancelled = false;

    async function run() {
      const currentProject = activeProject!;
      const nextUrls = await renderLayerThumbnailUrls(
        currentProject,
        assets,
        width,
        height,
      );

      if (cancelled) {
        revokeObjectUrls(nextUrls);
        return;
      }

      const previousUrls = urlsRef.current;
      urlsRef.current = nextUrls;
      setUrls(nextUrls);
      revokeObjectUrls(previousUrls);
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [assets, height, project, width]);

  useEffect(() => {
    return () => {
      revokeObjectUrls(urlsRef.current);
      urlsRef.current = {};
    };
  }, []);

  return urls;
}
