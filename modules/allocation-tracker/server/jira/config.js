/**
 * Multi-project configuration helpers.
 * Provides storage key namespacing for multi-project storage.
 * No I/O dependencies — safe to use in any environment.
 */

/**
 * Get the storage prefix for a project.
 * @param {string} projectKey - Jira project key (e.g., 'RHOAIENG')
 * @returns {string} Storage prefix (e.g., 'data/RHOAIENG/')
 */
function getStoragePrefix(projectKey) {
  return `data/${projectKey}/`;
}

/**
 * Create read/write functions that automatically prepend a storage prefix.
 * @param {string} prefix - Storage prefix (e.g., 'data/RHOAIENG/')
 * @param {function} readStorage - Original read function
 * @param {function} writeStorage - Original write function
 * @returns {{ read: function, write: function }}
 */
function createPrefixedStorage(prefix, readStorage, writeStorage) {
  return {
    read: (key) => readStorage(`${prefix}${key}`),
    write: (key, data) => writeStorage(`${prefix}${key}`, data)
  };
}

module.exports = {
  getStoragePrefix,
  createPrefixedStorage
};
