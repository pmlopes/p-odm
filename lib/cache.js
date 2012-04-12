'use strict';

function Cache(options) {
  this.store = {};
  options = options || {cacheSize: 256, ttl: 30000};
  this.size = options.cacheSize || 256;
  this.ttl  = options.ttl       || 30000;
  this.keys = 0;
}

Cache.prototype.has = function(id) {
  return this.store.hasOwnProperty(id);
};

Cache.prototype.prune = function() {
  if (this.keys > this.size) {
    var self = this;
    process.nextTick(function () {
      var objKeys = Object.keys(self.store),
          pruned = self.keys - self.size;

      objKeys.sort(function (a, b) {
        return self.store[a].atime > self.store[b].atime ? 1 : -1;
      });

      var i;
      for (i = 0; i < pruned; i++) {
        delete(self.store[objKeys[i]]);
      }
      self.keys -= pruned;
    });
  }
};

Cache.prototype.get = function(id) {
  if (this.store.hasOwnProperty(id)) {
    var entry = this.store[id];
    var now = Date.now();

    if(entry.atime + this.ttl < now) {
      this.del(id);
      // do not return null since it can mean a not found
      return undefined;
    }

    entry.atime = now;
    return entry.document;
  }
};

Cache.prototype.set = function(id, doc) {
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

Cache.prototype.del = function(id) {
  if (id) {
    delete(this.store[id]);
    this.keys--;
  } else {
    this.store = {};
  }
};

module.exports = Cache;
