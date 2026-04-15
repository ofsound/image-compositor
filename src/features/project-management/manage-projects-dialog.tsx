import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { ProjectSummary } from "../../../electron/contract";

function ProjectRow({
  project,
  current,
  actions,
}: {
  project: ProjectSummary;
  current: boolean;
  actions: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-sunken p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-text">
            {project.title}
          </div>
          <div className="font-mono text-[10px] text-text-faint">
            updated {new Date(project.updatedAt).toLocaleString()}
          </div>
          {current ? (
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
              current
            </div>
          ) : project.locked ? (
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-amber-500">
              open in another window
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      </div>
    </div>
  );
}

interface ManageProjectsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeProjects: ProjectSummary[];
  trashedProjects: ProjectSummary[];
  activeProjectId: string;
  onSetActiveProject: (projectId: string) => Promise<unknown>;
  onOpenProjectInNewWindow: (projectId: string) => Promise<unknown>;
  onTrashProject: (projectId: string) => Promise<void>;
  onRestoreProject: (projectId: string) => Promise<void>;
  onPurgeProject: (projectId: string) => Promise<void>;
}

export function ManageProjectsDialog({
  open,
  onOpenChange,
  activeProjects,
  trashedProjects,
  activeProjectId,
  onSetActiveProject,
  onOpenProjectInNewWindow,
  onTrashProject,
  onRestoreProject,
  onPurgeProject,
}: ManageProjectsDialogProps) {
  const [purgeDialogProjectId, setPurgeDialogProjectId] = useState<string | null>(null);
  const purgeDialogProject =
    [...activeProjects, ...trashedProjects].find(
      (project) => project.id === purgeDialogProjectId,
    ) ?? null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage projects</DialogTitle>
            <DialogDescription>
              Browse active projects, restore trashed work, and permanently
              remove discarded projects.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
                Active projects
              </div>
              {activeProjects.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  current={project.id === activeProjectId}
                  actions={
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={project.id === activeProjectId}
                        onClick={() => void onSetActiveProject(project.id)}
                      >
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void onOpenProjectInNewWindow(project.id)}
                      >
                        New Window
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={project.locked && !project.lockedByCurrentWindow}
                        onClick={() => void onTrashProject(project.id)}
                      >
                        Trash
                      </Button>
                    </>
                  }
                />
              ))}
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
                Trash
              </div>
              {trashedProjects.length === 0 ? (
                <div className="rounded-md bg-surface-sunken p-4 text-xs text-text-faint">
                  Trash is empty.
                </div>
              ) : (
                trashedProjects.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    current={false}
                    actions={
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={project.locked && !project.lockedByCurrentWindow}
                          onClick={() => void onRestoreProject(project.id)}
                        >
                          Restore
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={project.locked && !project.lockedByCurrentWindow}
                          onClick={() => setPurgeDialogProjectId(project.id)}
                        >
                          Delete permanently
                        </Button>
                      </>
                    }
                  />
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(purgeDialogProject) && open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPurgeDialogProjectId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project permanently</DialogTitle>
            <DialogDescription>
              {purgeDialogProject
                ? `This permanently removes "${purgeDialogProject.title}", its saved versions, and its copied source files.`
                : "This permanently removes the project and its files."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setPurgeDialogProjectId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (!purgeDialogProjectId) return;
                void onPurgeProject(purgeDialogProjectId);
                setPurgeDialogProjectId(null);
              }}
            >
              Delete permanently
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
