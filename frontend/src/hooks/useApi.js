// src/hooks/useApi.js
// Generic hook: runs an API function, tracks loading/error, and lets you refetch.
import { useCallback, useEffect, useRef, useState } from "react";

export function useApi(apiFn, args = [], { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  // Track the latest request so an old, slow response can't overwrite a newer one
  const requestId = useRef(0);

  // Re-run when the arguments change (compared as JSON so objects work too)
  const argsKey = JSON.stringify(args);

  const fetchData = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await apiFn(...JSON.parse(argsKey));
      if (id === requestId.current) setData(result);
    } catch (err) {
      if (id === requestId.current) setError(err);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [apiFn, argsKey]);

  useEffect(() => {
    if (enabled) fetchData();
    // Invalidate any in-flight request when unmounting or args change
    return () => { requestId.current++; };
  }, [fetchData, enabled]);

  return { data, loading, error, refetch: fetchData };
}