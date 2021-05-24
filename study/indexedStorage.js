/**
 * This mini-module provides a storage abstraction for indexed databases.
 * @module study.indexedStorage
 */

import Dexie from 'dexie';

export class indexedStorage {
    /**
     * Create a storage area with indexed fields.
     * Storage is implemented with Dexie. The `stores` field specifies the Dexie tables to be created
     * and their indexed fields. See the Dexie documentation for syntax: https://dexie.org/docs/Version/Version.stores().
     * @param {string} storageAreaName - A name that uniquely identifies the storage area.
     * @param {Object} stores - The tables to be created, see Dexie documentation linked above.
     * @param {string} defaultStore - The table to use if one is not specified in future interactions.
     */
    constructor(storageAreaName, stores, defaultStore="") {
        this.storageAreaName = storageAreaName;
        this.defaultStore = defaultStore == "" ? Object.keys(stores)[0] : defaultStore;

        this.storageInstance = new Dexie(this.storageAreaName);
        this.storageInstance.version(1).stores(stores);
        this.timeKey = "";
    }

    setTimeKey(timeKeyName) {
        this.timeKey = timeKeyName;
    }

    async set(item, store="") {
        await this.storageInstance[store === "" ? this.defaultStore : store].put(item);
    }

    async get(key, store="") {
        const result = await this.storageInstance[store == "" ? this.defaultStore : store].get(key);
        return result;
    }

    search(query, store="") {
        return this.storageInstance[store == "" ? this.defaultStore : store].where(query).toArray();
    }

    async getEventsByRange(startTime, endTime, store=""){
        const result = await this.storageInstance[store=="" ? this.defaultStore : store]
            .where(this.timeKey)
            .inAnyRange([[startTime, endTime]])
            .toArray();
        return result;
    }

}

// Prevents IndexedDB data from getting deleted without user intervention
// Ignoring the promise resolution because we still want to use storage
// even if Firefox won't guarantee persistence
try {
navigator.storage.persist();
} catch {
    // ignore
}
