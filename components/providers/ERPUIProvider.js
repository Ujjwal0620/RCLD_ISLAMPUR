"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore, useState } from "react";

const ERPUIContext = createContext(null);

export function ERPUIProvider({ children }) {
  const cacheRef = useRef(new Map());
  const listenersRef = useRef(new Set());
  const inFlightRef = useRef(new Map());
  const toastTimerRef = useRef(new Map());
  const [toasts, setToasts] = useState([]);

  const emit = useCallback(() => {
    listenersRef.current.forEach((listener) => listener());
  }, []);

  const getCache = useCallback((key) => cacheRef.current.get(key), []);
  const setCache = useCallback((key, value) => {
    cacheRef.current.set(key, value);
    emit();
    return value;
  }, [emit]);

  const invalidate = useCallback((prefixes = []) => {
    const keys = Array.isArray(prefixes) ? prefixes : [prefixes];
    for (const key of cacheRef.current.keys()) {
      if (keys.some((prefix) => String(key).startsWith(String(prefix)))) cacheRef.current.delete(key);
    }
    emit();
  }, [emit]);

  const fetchCached = useCallback((key, fetcher, { force = false, staleTime = 60_000 } = {}) => {
    const cached = cacheRef.current.get(key);
    if (!force && cached?.expiresAt > Date.now()) return Promise.resolve(cached.data);
    if (inFlightRef.current.has(key)) return inFlightRef.current.get(key);
    const request = Promise.resolve().then(fetcher).then((data) => {
      cacheRef.current.set(key, { data, expiresAt: Date.now() + staleTime });
      emit();
      return data;
    }).finally(() => inFlightRef.current.delete(key));
    inFlightRef.current.set(key, request);
    return request;
  }, [emit]);

  const dismissToast = useCallback((id) => {
    const timer = toastTimerRef.current.get(id);
    if (timer) clearTimeout(timer);
    toastTimerRef.current.delete(id);
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback((message, type = "success", duration = 3800) => {
    const id = `erp-toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((items) => [...items.slice(-3), { id, message: String(message || ""), type }]);
    if (duration > 0) toastTimerRef.current.set(id, setTimeout(() => dismissToast(id), duration));
    return id;
  }, [dismissToast]);

  useEffect(() => () => {
    toastTimerRef.current.forEach((timer) => clearTimeout(timer));
    toastTimerRef.current.clear();
  }, []);

  const value = useMemo(() => ({
    getCache, setCache, invalidate, fetchCached, notify, dismissToast,
    subscribe: (listener) => {
      listenersRef.current.add(listener);
      return () => listenersRef.current.delete(listener);
    },
  }), [getCache, setCache, invalidate, fetchCached, notify, dismissToast]);

  return (
    <ERPUIContext.Provider value={value}>
      {children}
      <div className="erp-toast-viewport" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div className={`erp-toast erp-toast-${toast.type}`} key={toast.id} role={toast.type === "error" ? "alert" : "status"}>
            <span className="erp-toast-indicator" />
            <span className="erp-toast-message">{toast.message}</span>
            <button type="button" onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification">×</button>
          </div>
        ))}
      </div>
    </ERPUIContext.Provider>
  );
}

export function useErpToast() {
  const context = useContext(ERPUIContext);
  if (!context) throw new Error("useErpToast must be used inside ERPUIProvider");
  return context.notify;
}

export function useErpCache() {
  const context = useContext(ERPUIContext);
  if (!context) throw new Error("useErpCache must be used inside ERPUIProvider");
  return { getCache: context.getCache, setCache: context.setCache, invalidate: context.invalidate, fetchCached: context.fetchCached };
}

export function useErpQuery(key, fetcher, options = {}) {
  const context = useContext(ERPUIContext);
  if (!context) throw new Error("useErpQuery must be used inside ERPUIProvider");
  const { enabled = true, staleTime = 60_000 } = options;
  const subscribe = useCallback((listener) => context.subscribe(listener), [context]);
  const getSnapshot = useCallback(() => context.getCache(key) || null, [context, key]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const [loading, setLoading] = useState(enabled && !snapshot);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const cached = context.getCache(key);
    if (cached?.expiresAt > Date.now()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    context.fetchCached(key, fetcher, { staleTime }).then(() => {
      if (active) { setError(null); setLoading(false); }
    }).catch((reason) => {
      if (active) { setError(reason); setLoading(false); }
    });
    return () => { active = false; };
  }, [context, key, enabled, fetcher, staleTime]);

  return { data: snapshot?.data ?? null, loading, error, setData: (value) => context.setCache(key, { data: value, expiresAt: Date.now() + staleTime }) };
}
