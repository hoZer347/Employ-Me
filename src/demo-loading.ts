// The loading bar over each Loom demo while it comes up.
//
// The player fetches its wasm itself and reports no progress, so the page
// fetches the player every demo shares first, counting its bytes for each
// bar, and the frames then load it from the HTTP cache. Once it is in, each
// bar holds full until its player sets Module.initialized.

/** The files that make up nearly all of the player's download. */
export const BUILD_FILES = ["player.wasm", "player.js"] as const;

export interface BuildFile {
  url: string;
  /**
   * Its size from the build's version.json. A compressed or chunked response
   * has no Content-Length, so this is what the bar counts against.
   */
  size?: number;
}

/**
 * Fetches `files` together, calling `progress` with the fraction of their
 * bytes in so far. The frame then takes them from the HTTP cache. A file that
 * fails is left for the frame to fetch and report.
 */
export async function prefetch(files: readonly BuildFile[], progress: (fraction: number) => void): Promise<void> {
  const responses = await Promise.all(
    files.map(async (file) => {
      const res = await fetch(file.url).catch(() => null);
      if (!res?.ok || !res.body) return null;
      return { body: res.body, size: file.size ?? Number(res.headers.get("Content-Length") ?? 0) };
    }),
  );
  const fetched = responses.filter((res) => res !== null);
  const total = fetched.reduce((sum, res) => sum + res.size, 0);

  let received = 0;
  await Promise.all(
    fetched.map(async ({ body }) => {
      const reader = body.getReader();
      for (;;) {
        const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }));
        if (done || !value) return;
        received += value.byteLength;
        if (total > 0) progress(Math.min(1, received / total));
      }
    }),
  );
  progress(1);
}

/**
 * Runs `load` once, however many callers ask for it, telling each of them how
 * far along it is from the moment they ask.
 */
export function shared(load: (progress: (fraction: number) => void) => Promise<void>) {
  const listeners = new Set<(fraction: number) => void>();
  let latest = 0;
  let loading: Promise<void> | undefined;
  return (progress: (fraction: number) => void): Promise<void> => {
    listeners.add(progress);
    progress(latest);
    loading ??= load((fraction) => {
      latest = fraction;
      listeners.forEach((listener) => listener(fraction));
    });
    return loading;
  };
}
