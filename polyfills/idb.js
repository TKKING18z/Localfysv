// idb.js polyfill
// This file is used to provide a polyfill for the 'idb' module
// which is used by Firebase but has compatibility issues with Metro

// Simple implementation of the idb interface for Firebase's needs
const idb = {
  // Basic IndexedDB functionality required by Firebase
  openDB: async (name, version, { upgrade } = {}) => {
    // Return a minimal DB implementation that Firebase can use
    return {
      get: async () => null,
      put: async () => null,
      delete: async () => null,
      clear: async () => null,
      getAllKeys: async () => [],
      transaction: () => ({
        objectStore: () => ({
          get: async () => null,
          put: async () => null,
          delete: async () => null,
          clear: async () => null,
          getAllKeys: async () => []
        }),
        done: Promise.resolve()
      }),
      close: () => {}
    };
  },
  deleteDB: async () => {},
  unwrap: (val) => val,
  wrap: (val) => val
};

export default idb;
export const { openDB, deleteDB, unwrap, wrap } = idb;