/**
 * addressSelectionBridge
 *
 * React Navigation cannot serialize functions as route params, so we never
 * pass `onAddressSelected` directly. Instead, the caller registers a callback
 * here under a unique string key and passes only that key as a nav param.
 * AddressBookScreen calls `resolve(key, address)` when an address is chosen.
 */
import { DeliveryAddress } from '../services/checkoutAPI';

type AddressCallback = (address: DeliveryAddress) => void;

const _callbacks = new Map<string, AddressCallback>();

export const addressSelectionBridge = {
  register(key: string, cb: AddressCallback) {
    _callbacks.set(key, cb);
  },
  resolve(key: string, address: DeliveryAddress) {
    _callbacks.get(key)?.(address);
    _callbacks.delete(key);
  },
  clear(key: string) {
    _callbacks.delete(key);
  },
};
