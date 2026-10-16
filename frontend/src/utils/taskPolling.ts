export function mergePolledTasks<T extends { id: string }>(current: T[], polledIds: Set<string>, updates: T[]): T[] {
  return [...updates, ...current.filter((task) => !polledIds.has(task.id))];
}
