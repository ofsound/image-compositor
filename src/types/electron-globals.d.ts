import type { ElectronAppApi } from "../../electron/contract";

declare global {
  interface Window {
    compositorElectron?: ElectronAppApi;
  }
}

export {};
