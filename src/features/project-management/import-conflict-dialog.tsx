import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BundleImportInspection } from "@/types/project";

interface ImportConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspection: BundleImportInspection | null;
  onResolve: (resolution: "replace" | "copy") => Promise<void>;
}

export function ImportConflictDialog({
  open,
  onOpenChange,
  inspection,
  onResolve,
}: ImportConflictDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import conflict</DialogTitle>
          <DialogDescription>
            {inspection?.conflictProject
              ? `The bundle "${inspection.fileName}" matches the existing project "${inspection.conflictProject.title}".`
              : "Choose how to import this project bundle."}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md bg-surface-sunken p-3 text-xs text-text-muted">
          Replace will overwrite the existing local project with the bundle
          contents. Import as copy will preserve the existing project and
          create a new project with remapped IDs.
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => void onResolve("copy")}
          >
            Import as copy
          </Button>
          <Button
            variant="secondary"
            onClick={() => void onResolve("replace")}
          >
            Replace existing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
