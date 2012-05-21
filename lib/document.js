'use strict';

var mongodb = require('mongodb');
var ObjectID = mongodb.BSONPure.ObjectID;
var Cache = require('./cache');

/**
 * Helper caching function
 *
 * @param {Object} cache The Cache Manager Objects
 * @param {String} mongoCol Mongo Collection name
 * @param {String} field field used to index the cache
 * @param {String} value the value for the index key
 * @return {Object}
 */
function isCached(cache, mongoCol, field, value) {
  if (value instanceof ObjectID) {
    return cache.get(mongoCol + ':' + field + ':' + value.toHexString());
  }
  return cache.get(mongoCol + ':' + field + ':' + value);
}

/**
 * Helper caching function
 *
 * @param {Object} cache The Cache Manager Objects
 * @param {String} mongoCol Mongo Collection name
 * @param {String} field field used to index the cache
 * @param {String} value the value for the index key
 * @param {Object} doc Document to store
 */
function putToCache(cache, mongoCol, field, value, doc) {
  if (value !== undefined && value !== null) {
    if (value instanceof ObjectID) {
      cache.set(mongoCol + ':' + field + ':' + value.toHexString(), doc);
    }
  }
  cache.set(mongoCol + ':' + field + ':' + value, doc);
}

module.exports = function (mongoCollection, l2cache) {

  var odm = this;

  var cache = l2cache ? new Cache({cacheSize: 256, ttl: 300000}) : undefined;

  var Model = function () {
    throw new Error('Documents are read only and cannot be instantiated');
  };

  Model.findOne = function (query, fields, options, callback) {

    if (callback === undefined) {
      callback = options;
      options = {};
    }

    odm.collection(mongoCollection, options, function (err, collection) {
      if (err) {
        return callback(err);
      }

      collection.findOne(query, options, function (err, documentLoaded) {
        if (err) {
          return callback(err);
        }

        return callback(null, documentLoaded);
      });
    });
  };

  Model.find = function (query, fields, options, callback) {

    if (callback === undefined) {
      if (options === undefined) {
        callback = fields;
        options = {};
        fields = {};
      } else {
        callback = options;
        options = {};
      }
    }

    odm.collection(mongoCollection, options, function (err, collection) {
      if (err) {
        return callback(err);
      }

      collection.find(query, fields, options, function (err, cursor) {
        if (err) {
          return callback(err);
        }
        cursor.toArray(function (err, documentsLoaded) {
          if (err) {
            return callback(err);
          }

          return callback(null, documentsLoaded);
        });
      });
    });
  };

  Model.findAll = function (fields, options, callback) {

    if (callback === undefined) {
      if (options === undefined) {
        callback = fields;
        options = {};
        fields = {};
      } else {
        callback = options;
        options = {};
      }
    }

    // verify if it is in cache
    if (l2cache) {
      var cachedDocuments = isCached(cache, mongoCollection, '', 'all');

      if (cachedDocuments !== undefined) {
        return callback(null, cachedDocuments);
      }
    }

    odm.collection(mongoCollection, options, function (err, collection) {
      if (err) {
        return callback(err);
      }

      collection.find({}, fields, options, function (err, cursor) {
        if (err) {
          return callback(err);
        }
        cursor.toArray(function (err, documentsLoaded) {
          if (err) {
            return callback(err);
          }

          if (l2cache) {
            putToCache(cache, mongoCollection, '', 'all', documentsLoaded);
          }

          return callback(null, documentsLoaded);
        });
      });
    });
  };

  return Model;
};