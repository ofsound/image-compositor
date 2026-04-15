import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface OpenProjectConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectTitle: string | null;
  onReveal: () => void;
  onDuplicate: () => void;
}

export function OpenProjectConflictDialog({
  open,
  onOpenChange,
  projectTitle,
  onReveal,
  onDuplicate,
}: OpenProjectConflictDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Project already open</DialogTitle>
          <DialogDescription>
            {projectTitle
              ? `"${projectTitle}" is already being edited in another window.`
              : "This project is already being edited in another window."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="outline" onClick={onReveal}>
            Reveal Existing Window
          </Button>
          <Button variant="secondary" onClick={onDuplicate}>
            Duplicate as Copy
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
