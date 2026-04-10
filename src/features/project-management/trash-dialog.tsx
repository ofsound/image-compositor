import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TrashDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectTitle: string;
  onSubmit: () => Promise<void>;
}

export function TrashDialog({
  open,
  onOpenChange,
  projectTitle,
  onSubmit,
}: TrashDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move project to trash</DialogTitle>
          <DialogDescription>
            {`"${projectTitle}" will be removed from the active project list but can still be restored from the project manager.`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => void onSubmit()}>
            Move to trash
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
