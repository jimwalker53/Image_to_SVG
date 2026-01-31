import { useState, useCallback } from 'react';

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

interface UseHistoryReturn<T> {
  state: T;
  setState: (newState: T | ((prev: T) => T)) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: (newState: T) => void;
  historyLength: number;
}

/**
 * Custom hook for managing state with undo/redo history
 * @param initialState - The initial state value
 * @param maxHistoryLength - Maximum number of history items to keep (default 50)
 */
export function useHistory<T>(
  initialState: T,
  maxHistoryLength: number = 50
): UseHistoryReturn<T> {
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const setState = useCallback((newState: T | ((prev: T) => T)) => {
    setHistory(prev => {
      const resolvedState = typeof newState === 'function'
        ? (newState as (prev: T) => T)(prev.present)
        : newState;

      // Don't add to history if state hasn't changed
      if (JSON.stringify(resolvedState) === JSON.stringify(prev.present)) {
        return prev;
      }

      // Limit history length
      const newPast = [...prev.past, prev.present].slice(-maxHistoryLength);

      return {
        past: newPast,
        present: resolvedState,
        future: [], // Clear future on new change
      };
    });
  }, [maxHistoryLength]);

  const undo = useCallback(() => {
    setHistory(prev => {
      if (prev.past.length === 0) return prev;

      const newPast = prev.past.slice(0, -1);
      const newPresent = prev.past[prev.past.length - 1];
      const newFuture = [prev.present, ...prev.future];

      return {
        past: newPast,
        present: newPresent,
        future: newFuture,
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory(prev => {
      if (prev.future.length === 0) return prev;

      const newFuture = prev.future.slice(1);
      const newPresent = prev.future[0];
      const newPast = [...prev.past, prev.present];

      return {
        past: newPast,
        present: newPresent,
        future: newFuture,
      };
    });
  }, []);

  const reset = useCallback((newState: T) => {
    setHistory({
      past: [],
      present: newState,
      future: [],
    });
  }, []);

  return {
    state: history.present,
    setState,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    reset,
    historyLength: history.past.length,
  };
}
