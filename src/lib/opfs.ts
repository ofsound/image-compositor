import { db } from "@/lib/db";

async function getDirectoryHandle() {
  if (!("storage" in navigator) || !("getDirectory" in navigator.storage)) {
    return null;
  }
  return navigator.storage.getDirectory();
}

async function getFileHandle(path: string, create = false) {
  const root = await getDirectoryHandle();
  if (!root) return null;

  const parts = path.split("/").filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) return null;

  let current = root;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create });
  }

  return current.getFileHandle(fileName, { create });
}

function supportsWritable(
  handle: FileSystemFileHandle | null,
): handle is FileSystemFileHandle & {
  createWritable: () => Promise<FileSystemWritableFileStream>;
} {
  return !!handle && typeof (handle as { createWritable?: unknown }).createWritable === "function";
}

export async function writeBlob(path: string, blob: Blob) {
  const handle = await getFileHandle(path, true).catch(() => null);

  if (!supportsWritable(handle)) {
    await db.blobs.put({ path, blob });
    return;
  }

  try {
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    await db.blobs.delete(path);
  } catch {
    await db.blobs.put({ path, blob });
  }
}

export async function readBlob(path: string) {
  const cachedRecord = await db.blobs.get(path);
  if (cachedRecord) {
    return cachedRecord.blob;
  }

  const handle = await getFileHandle(path).catch(() => null);

  if (!handle) {
    return null;
  }

  try {
    const file = await handle.getFile();
    return file;
  } catch {
    return null;
  }
}

export async function deleteBlob(path: string) {
  const root = await getDirectoryHandle().catch(() => null);

  if (root) {
    const parts = path.split("/").filter(Boolean);
    const fileName = parts.pop();
    if (fileName) {
      let current = root;
      try {
        for (const part of parts) {
          current = await current.getDirectoryHandle(part);
        }
        await current.removeEntry(fileName).catch(() => undefined);
      } catch {
        // Ignore directory traversal failures and still clear the IndexedDB fallback.
      }
    }
  }

  await db.blobs.delete(path);
}
