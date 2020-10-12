import { executeCallback, getItemKeyValue } from './../utils.js';

export function startsWith(prefix, callback) {
    var localforageInstance = this;
    var promise = new Promise(function(resolve, reject) {
        localforageInstance.keys().then(function(keys) {

            var itemPromises = [];

            var prefixLength = prefix.length;
            for (var i = 0, len = keys.length; i < len; i++) {
                var key = keys[i];

                if (key.slice(0, prefixLength) === prefix) {
                    itemPromises.push(getItemKeyValue.call(localforageInstance, key));
                }
            }

            Promise.all(itemPromises).then(function(keyValuePairs) {
                var result = {};
                for (var i = 0, len = keyValuePairs.length; i < len; i++) {
                    var keyValuePair = keyValuePairs[i];

                    result[keyValuePair.key] = keyValuePair.value;
                }
                resolve(result);
            }).catch(reject);
        }).catch(reject);
    });
    executeCallback(promise, callback);
    return promise;
}

export function keysStartingWith(prefix, callback) {
    var localforageInstance = this;
    var promise = new Promise(function(resolve, reject) {
        localforageInstance.keys().then(function(keys) {

            var result = [];

            var prefixLength = prefix.length;
            for (var i = 0, len = keys.length; i < len; i++) {
                var key = keys[i];

                if (key.slice(0, prefixLength) === prefix) {
                    result.push(key);
                }
            }

            resolve(result);
        }).catch(reject);
    });
    executeCallback(promise, callback);
    return promise;
}
