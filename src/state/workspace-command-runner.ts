export interface WorkspaceCommandState {
  busy: boolean;
  status: string;
}

type SetState<State> = (
  partial:
    | Partial<State>
    | ((state: State) => Partial<State>),
) => void;

type GetState<State> = () => State;

export interface RunWorkspaceCommandOptions<State extends WorkspaceCommandState> {
  busy?: boolean;
  startStatus?: string;
  queue?: boolean;
  key?: string;
  getErrorStatus?: (error: unknown) => string;
  onError?: (error: unknown, state: State) => void;
}

export interface WorkspaceCommandRunner<State extends WorkspaceCommandState> {
  run: <T>(
    task: () => Promise<T>,
    options?: RunWorkspaceCommandOptions<State>,
  ) => Promise<T>;
}

export function createWorkspaceCommandRunner<State extends WorkspaceCommandState>(
  set: SetState<State>,
  get: GetState<State>,
): WorkspaceCommandRunner<State> {
  let busyCommandCount = 0;
  let queuedExecution = Promise.resolve();
  let nextSequence = 0;
  const latestSequenceByKey = new Map<string, number>();

  function updateBusyFlag() {
    const busy = busyCommandCount > 0;
    if (get().busy !== busy) {
      set({ busy } as Partial<State>);
    }
  }

  return {
    async run<T>(task: () => Promise<T>, options?: RunWorkspaceCommandOptions<State>) {
      const useBusy = options?.busy ?? false;
      const useQueue = options?.queue ?? true;
      const key = options?.key;
      const sequence = nextSequence + 1;
      nextSequence = sequence;
      const startStatus = options?.startStatus;
      const onError = options?.onError;
      const getErrorStatus = options?.getErrorStatus;

      if (key) {
        latestSequenceByKey.set(key, sequence);
      }

      const execute = async () => {
        if (key && latestSequenceByKey.get(key) !== sequence) {
          return undefined as T;
        }

        if (startStatus || useBusy) {
          set(() => ({
            ...(startStatus ? { status: startStatus } : {}),
            ...(useBusy ? { busy: true } : {}),
          }) as Partial<State>);
        }

        if (useBusy) {
          busyCommandCount += 1;
          updateBusyFlag();
        }

        try {
          return await task();
        } catch (error) {
          const state = get();
          if (onError) {
            onError(error, state);
          } else if (getErrorStatus) {
            set({ status: getErrorStatus(error) } as Partial<State>);
          }
          throw error;
        } finally {
          if (useBusy) {
            busyCommandCount = Math.max(0, busyCommandCount - 1);
            updateBusyFlag();
          }
        }
      };

      if (!useQueue) {
        return execute();
      }

      const next = queuedExecution.then(execute, execute);
      queuedExecution = next.then(() => undefined, () => undefined);
      return next;
    },
  };
}
