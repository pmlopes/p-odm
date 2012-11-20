'use strict';

/**
 * @name Cache
 *
 * @param options
 * @constructor
 *
 * @property {Object} store
 * @property {Number} size
 * @property {Number} ttl
 * @property {Number} keys
 */
function Cache(options) {
  this.store = {};
  options = options || {cacheSize: 4096, ttl: 30000};
  this.size = options.cacheSize || 4096;
  this.ttl  = options.ttl       || 30000;
  this.keys = 0;
}

/**
 * @memberOf Cache.prototype
 *
 * @param id
 * @return {Boolean}
 */
Cache.prototype.has = function (id) {
  if (id) {
    return this.store.hasOwnProperty(id);
  }
  return false;
};

/**
 * @memberOf Cache.prototype
 */
Cache.prototype.prune = function () {
  if (this.keys > this.size) {
    var self = this;
    process.nextTick(function () {
      var objKeys = Object.keys(self.store);
      var pruned = self.keys - self.size;

      objKeys.sort(function (a, b) {
        return self.store[a].atime > self.store[b].atime ? 1 : -1;
      });

      var i;
      for (i = 0; i < pruned; i++) {
        delete (self.store[objKeys[i]]);
      }
      self.keys -= pruned;
    });
  }
};

/**
 * @memberOf Cache.prototype
 *
 * @param id
 * @return {*}
 */
Cache.prototype.get = function (id) {
  if (this.store.hasOwnProperty(id)) {
    var entry = this.store[id];
    var now = Date.now();

    if (entry.atime + this.ttl < now) {
      this.del(id);
      // do not return null since it can mean a not found
      return undefined;
    }

    entry.atime = now;
    return entry.document;
  }
};

/**
 * @memberOf Cache.prototype
 *
 * @param id
 * @param doc
 * @return {*}
 */
Cache.prototype.set = function (id, doc) {
  if (!this.has(id)) {
    this.keys++;
    this.prune();
  }

  this.store[id] = {
    atime:    Date.now(),
    document: doc
  };

  return this.store[id];
};

/**
 * @memberOf Cache.prototype
 *
 * @param id
 */
Cache.prototype.del = function (id) {
  if (this.has(id)) {
    delete (this.store[id]);
    this.keys--;
  }
};

/**
 * @memberOf Cache.prototype
 */
Cache.prototype.reset = function () {
  var keys = Object.keys(this.store);
  var i;
  for (i = 0; i < keys.length; i++) {
    if (this.store.hasOwnProperty(keys[i])) {
      delete this.store[keys[i]];
    }
  }
  this.keys = 0;
};

module.exports = Cache;
