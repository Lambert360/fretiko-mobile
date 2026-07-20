/**
 * riderSelectionBridge
 *
 * React Navigation cannot serialize functions as route params, so we never
 * pass `onRiderSelected` directly. Instead, the caller registers a callback
 * here under a unique string key and passes only that key as a nav param.
 * RiderSelectionScreen calls `resolve(key, rider)` when a rider is chosen.
 */
type RiderCallback = (rider: any) => void;

const _callbacks = new Map<string, RiderCallback>();

export const riderSelectionBridge = {
  register(key: string, cb: RiderCallback) {
    _callbacks.set(key, cb);
  },
  resolve(key: string, rider: any) {
    _callbacks.get(key)?.(rider);
    _callbacks.delete(key);
  },
  clear(key: string) {
    _callbacks.delete(key);
  },
};
