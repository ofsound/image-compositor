import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ProjectVersion } from "@/types/project";

interface VersionsDialogProps {
  versions: ProjectVersion[];
  onRestoreVersion: (versionId: string) => Promise<void>;
  trigger: React.ReactNode;
}

export function VersionsDialog({
  versions,
  onRestoreVersion,
  trigger,
}: VersionsDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Saved versions</DialogTitle>
          <DialogDescription>
            Named snapshots with exact seeds and parameters.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {versions.map((version) => (
            <button
              key={version.id}
              className="flex w-full items-center justify-between rounded-md border border-border-subtle px-3 py-3 text-left transition-colors hover:bg-surface-muted"
              onClick={() => void onRestoreVersion(version.id)}
            >
              <div>
                <div className="text-sm font-medium text-text">
                  {version.label}
                </div>
                <div className="font-mono text-[10px] text-text-faint">
                  {new Date(version.createdAt).toLocaleString()}
                </div>
              </div>
              <RefreshCw className="h-3.5 w-3.5 text-text-faint" />
            </button>
          ))}
          {versions.length === 0 ? (
            <div className="rounded-md bg-surface-sunken p-4 text-xs text-text-faint">
              No saved versions yet.
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
