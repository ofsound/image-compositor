import type {
  CanonicalProjectPayload,
  ElectronBinaryPayload,
} from "../../electron/contract";

import { readBlob } from "@/lib/opfs";
import type { ImportedProjectBundle, ProjectDocument, ProjectVersion, SourceAsset } from "@/types/project";

function binaryToBlobMap(payloads: Record<string, ElectronBinaryPayload>) {
  return Object.fromEntries(
    Object.entries(payloads).map(([filePath, payload]) => [filePath, new Blob([payload])]),
  );
}

async function blobToBinary(blob: Blob | null) {
  if (!blob) {
    return null;
  }

  return await blob.arrayBuffer();
}

export function getElectronApi() {
  if (typeof window === "undefined" || !window.compositorElectron) {
    return null;
  }

  return window.compositorElectron;
}

export function isElectronWorkspace() {
  return Boolean(getElectronApi());
}

export function fromCanonicalProjectPayload(
  payload: CanonicalProjectPayload,
): ImportedProjectBundle {
  return {
    projectDoc: structuredClone(payload.projectDoc),
    versionDocs: structuredClone(payload.versionDocs),
    assetDocs: structuredClone(payload.assetDocs),
    assetBlobs: binaryToBlobMap(payload.assetBlobs),
    versionBlobs: binaryToBlobMap(payload.versionBlobs),
    manifest: {
      version: 4,
      projectId: payload.projectDoc.id,
      exportedAt: new Date().toISOString(),
      assetIds: payload.assetDocs.map((asset) => asset.id),
      versionIds: payload.versionDocs.map((version) => version.id),
    },
  };
}

export async function toCanonicalProjectPayload(
  bundle: Pick<
    ImportedProjectBundle,
    "projectDoc" | "versionDocs" | "assetDocs" | "assetBlobs" | "versionBlobs"
  >,
): Promise<CanonicalProjectPayload> {
  return {
    projectDoc: structuredClone(bundle.projectDoc),
    versionDocs: structuredClone(bundle.versionDocs),
    assetDocs: structuredClone(bundle.assetDocs),
    assetBlobs: Object.fromEntries(
      (await Promise.all(
        Object.entries(bundle.assetBlobs).map(async ([filePath, blob]) => {
          const payload = await blobToBinary(blob);
          return payload ? ([filePath, payload] as const) : null;
        }),
      )).flatMap((entry) => (entry ? [entry] : [])),
    ),
    versionBlobs: Object.fromEntries(
      (await Promise.all(
        Object.entries(bundle.versionBlobs).map(async ([filePath, blob]) => {
          const payload = await blobToBinary(blob);
          return payload ? ([filePath, payload] as const) : null;
        }),
      )).flatMap((entry) => (entry ? [entry] : [])),
    ),
  };
}

export async function captureCanonicalProjectPayload(options: {
  project: ProjectDocument;
  versions: ProjectVersion[];
  assets: SourceAsset[];
}) {
  const { project, versions, assets } = options;

  const assetBlobs = Object.fromEntries(
    (await Promise.all(
      assets.flatMap(async (asset) => {
        const entries = await Promise.all(
          [asset.originalPath, asset.normalizedPath, asset.previewPath].map(
            async (filePath) => {
              const blob = await readBlob(filePath);
              const payload = await blobToBinary(blob);
              return payload ? ([filePath, payload] as const) : null;
            },
          ),
        );
        return entries.flatMap((entry) => (entry ? [entry] : []));
      }),
    )).flat(),
  );

  const versionBlobs = Object.fromEntries(
    (await Promise.all(
      versions.map(async (version) => {
        if (!version.thumbnailPath) {
          return null;
        }

        const blob = await readBlob(version.thumbnailPath);
        const payload = await blobToBinary(blob);
        return payload ? ([version.thumbnailPath, payload] as const) : null;
      }),
    )).flatMap((entry) => (entry ? [entry] : [])),
  );

  return {
    projectDoc: structuredClone(project),
    versionDocs: structuredClone(versions),
    assetDocs: structuredClone(assets),
    assetBlobs,
    versionBlobs,
  } satisfies CanonicalProjectPayload;
}
