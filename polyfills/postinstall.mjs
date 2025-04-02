// Simple polyfill for @firebase/util postinstall.mjs
export function getDefaultsFromPostinstall() {
  return {
    processEmulator: false,
    scheduleIncomingStreamsMicrotask: true
  };
}