declare module "heic2any" {
  interface Options {
    blob: Blob;
    toType?: string;
    quality?: number;
  }

  export default function heic2any(options: Options): Promise<Blob | Blob[]>;
}

declare module "utif" {
  export function decode(buffer: ArrayBuffer): unknown[];
  export function decodeImage(
    buffer: ArrayBuffer,
    image: unknown,
    ifds?: unknown[],
  ): void;
  export function toRGBA8(image: unknown): Uint8Array;
}

interface Window {
  compositorElectron?: import("../../electron/contract").ElectronAppApi;
}
