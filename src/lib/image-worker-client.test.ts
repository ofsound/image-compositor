import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { processImageFile } from "@/lib/image-worker-client";

class MockWorker {
  listeners = new Map<string, Set<(event: Event) => void>>();
  terminated = false;

  addEventListener(type: string, listener: (event: Event) => void) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  postMessage(_message: unknown) {}

  terminate() {
    this.terminated = true;
    this.listeners.clear();
  }

  dispatch(type: string, event: Event) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

function createCanvasMock(imageData?: ImageData) {
  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({
      drawImage: vi.fn(),
      getImageData: vi.fn(() => imageData),
    })),
    toBlob: vi.fn((callback: BlobCallback) => {
      callback(new Blob(["encoded"]));
    }),
  } as unknown as HTMLCanvasElement;
}

describe("processImageFile", () => {
  const workers: MockWorker[] = [];
  class WorkerMock {
    constructor() {
      const worker = new MockWorker();
      workers.push(worker);
      return worker as unknown as WorkerMock;
    }
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", WorkerMock);
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-0000-0000-000000000001",
    );
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({
        width: 4,
        height: 2,
        close: vi.fn(),
      }) as ImageBitmap),
    );
  });

  afterEach(() => {
    workers.length = 0;
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("terminates the timed-out worker before falling back to the main thread", async () => {
    const imageData = {
      data: new Uint8ClampedArray([
        255, 0, 0, 255,
        0, 255, 0, 255,
      ]),
      width: 4,
      height: 2,
    } as ImageData;
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockImplementationOnce(() => createCanvasMock() as never)
      .mockImplementationOnce(() => createCanvasMock() as never)
      .mockImplementationOnce(() => createCanvasMock(imageData) as never);
    const file = new File(["png"], "test.png", { type: "image/png" });

    const resultPromise = processImageFile(file);
    expect(workers).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(4_000);
    workers[0]?.dispatch(
      "message",
      new MessageEvent("message", {
        data: {
          requestId: "00000000-0000-0000-0000-000000000001",
          payload: {
            width: 999,
            height: 999,
          },
        },
      }),
    );

    const result = await resultPromise;

    expect(workers[0]?.terminated).toBe(true);
    expect(result.width).toBe(4);
    expect(result.height).toBe(2);
    createElementSpy.mockRestore();
  });
});
