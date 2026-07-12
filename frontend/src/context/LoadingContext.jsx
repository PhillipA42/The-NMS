import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

/**
 * LoadingContext
 *
 * Provides a global loading registry that any component can tap into.
 * Each request gets a unique key so multiple concurrent requests
 * are tracked independently — `isLoading` is true when *any* key
 * is still pending.
 *
 * Usage in a component:
 *   const { isLoading, startLoading, stopLoading } = useLoading();
 */

const LoadingContext = createContext();

let _counter = 0;

export const LoadingProvider = ({ children }) => {
  const [activeKeys, setActiveKeys] = useState(new Set());

  const startLoading = useCallback((key) => {
    if (!key) {
      _counter += 1;
      key = `__auto_${_counter}`;
    }
    setActiveKeys(prev => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    return key;
  }, []);

  const stopLoading = useCallback((key) => {
    setActiveKeys(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const isLoading = activeKeys.size > 0;

  const value = useMemo(() => ({
    isLoading,
    activeKeys,
    startLoading,
    stopLoading,
  }), [isLoading, activeKeys, startLoading, stopLoading]);

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = () => {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error('useLoading must be used inside <LoadingProvider>');
  return ctx;
};
