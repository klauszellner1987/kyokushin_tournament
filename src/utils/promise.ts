/**
 * Runs a list of asynchronous tasks in chunks to limit concurrency.
 * This prevents overwhelming the database or network when performing bulk operations.
 */
export async function runInChunks<T>(
  items: T[],
  fn: (item: T) => Promise<unknown>,
  chunkSize = 10
): Promise<void> {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await Promise.all(chunk.map((item) => fn(item)));
  }
}
