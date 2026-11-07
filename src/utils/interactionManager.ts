type Task = { cancel: () => void };

/**
 * Minimal replacement for React Native's removed InteractionManager.
 * Defers work until the current frame's interactions have finished.
 */
export const InteractionManager = {
  runAfterInteractions(callback: () => void): Task {
    const id = setTimeout(callback, 0);
    return { cancel: () => clearTimeout(id) };
  },
};
