let tail: Promise<unknown> = Promise.resolve()

/** Encadena el alta del administrador para que la sesión no se evalúe a medias. */
export function duringSetup<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(task, task)
  tail = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

export function waitForSetup(): Promise<void> {
  return tail.then(() => undefined)
}
