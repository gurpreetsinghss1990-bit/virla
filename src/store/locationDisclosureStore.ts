import { create } from 'zustand';

interface LocationDisclosureState {
  visible: boolean;
  request: () => Promise<boolean>;
  accept: () => void;
  decline: () => void;
}

let resolverRef: ((accepted: boolean) => void) | null = null;
let pendingRef: Promise<boolean> | null = null;

// Single shared promise so concurrent callers (e.g. two travel screens) wait for one answer.
export const requestBackgroundLocationDisclosure = (): Promise<boolean> => {
  if (pendingRef) return pendingRef;
  pendingRef = new Promise<boolean>((resolve) => {
    resolverRef = resolve;
  });
  useLocationDisclosureStore.setState({ visible: true });
  return pendingRef;
};

const settle = (accepted: boolean) => {
  const resolve = resolverRef;
  resolverRef = null;
  pendingRef = null;
  useLocationDisclosureStore.setState({ visible: false });
  resolve?.(accepted);
};

export const useLocationDisclosureStore = create<LocationDisclosureState>(() => ({
  visible: false,
  request: requestBackgroundLocationDisclosure,
  accept: () => settle(true),
  decline: () => settle(false),
}));
