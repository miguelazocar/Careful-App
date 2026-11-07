import { useCallback, useEffect, useEffectEvent, useState } from 'react';

import { useDataVersion } from '@/stores/ui';

type Dep = string | number | boolean | null | undefined;

interface State<T> {
  key: string | null;
  data: T | undefined;
  error: Error | null;
}

/**
 * Runs an async loader and re-runs it whenever its deps change or the local database changes.
 * Keeps the previous data while reloading to avoid flicker. `loading` is derived (no setState in effects).
 */
export function useQuery<T>(loader: () => Promise<T>, deps: Dep[] = []): { data: T | undefined; loading: boolean; error: Error | null; reload: () => void } {
  const version = useDataVersion((s) => s.version);
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<State<T>>({ key: null, data: undefined, error: null });
  const key = `${version}|${tick}|${JSON.stringify(deps)}`;
  const run = useEffectEvent(() => loader());

  useEffect(() => {
    let alive = true;
    run()
      .then((data) => alive && setState({ key, data, error: null }))
      .catch((e: unknown) => alive && setState((s) => ({ ...s, key, error: e instanceof Error ? e : new Error(String(e)) })));
    return () => {
      alive = false;
    };
  }, [key]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data: state.data, loading: state.key !== key, error: state.error, reload };
}
