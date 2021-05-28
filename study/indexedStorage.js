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

    /**
     * Set one of the indexed fields to be used in operations that look for events in a
     * certain time range (such as `getEventsByRange`).
     * @param {string} timeKeyName - Name of an indexed field that should be used as a timestamp.
     */
    setTimeKey(timeKeyName) {
        this.timeKey = timeKeyName;
    }

    /**
     * Store an item in the default (or another specified) store.
     * @param {Object} item - The item to store.
     * @param {string} store - Which store to use. If not specified, the default is used.
     */
    async set(item, store="") {
        await this.storageInstance[store === "" ? this.defaultStore : store].put(item);
    }

    /**
     * Look up an item in the default (or specified) store.
     * @param {Object} query - The key and value to find.
     * @param {string} store - Which store to use. If not specified, the default is used.
     * @return {Object} - One result matching the givven query.
     */
    async get(query, store="") {
        const result = await this.storageInstance[store == "" ? this.defaultStore : store].get(query);
        return result;
    }

    /**
     * Look up mathing items in the default (or specified) store.
     * @param {Object} query - The key and value to look for.
     * @param {string} store - Which store to use. If not specified, the default is used.
     * @return {Object} - All results matching the givven query.
     */
    search(query, store="") {
        return this.storageInstance[store == "" ? this.defaultStore : store].where(query).toArray();
    }

    /**
     * Retrieve all events within a specified time range, using the storage area's specified
     * time key.
     * @param {number} startTime - The timestamp of the beginning of the time range.
     * @param {number} endTime - The last timestamp within the time range.
     * @param {string} store - Which store to use. If not specified, the default is used.
     * @return {Object[]} - All matching items.
     */
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
