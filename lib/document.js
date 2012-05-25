'use strict';

var mongodb = require('mongodb');
var ObjectID = mongodb.BSONPure.ObjectID;
var Cache = require('./cache');

/**
 * Helper caching function
 *
 * @param {Object} cache The Cache Manager Objects
 * @param {String} field field used to index the cache
 * @param {String|ObjectID} value the value for the index key
 * @return {Object}
 */
function isCached(cache, field, value) {
  if (cache !== undefined) {
    if (value instanceof ObjectID) {
      return cache.get(field + ':' + value.toHexString());
    }
    return cache.get(field + ':' + value);
  }
  return undefined;
}

/**
 * Helper caching function
 *
 * @param {Object} cache The Cache Manager Objects
 * @param {String} field field used to index the cache
 * @param {String|ObjectID} value the value for the index key
 * @param {Object} doc Document to store
 */
function putToCache(cache, field, value, doc) {
  if (cache !== undefined) {
    if (value !== undefined && value !== null) {
      if (value instanceof ObjectID) {
        cache.set(field + ':' + value.toHexString(), doc);
      }
    }
    cache.set(field + ':' + value, doc);
  }
}

/**
 * Clears a cache entry for a specific model
 * @param {Object} cache The Cache Manager Objects
 * @param {String[]} indexes for the model
 * @param {Object} model Model that triggered the cleanup
 */
function purgeCache(cache, indexes, model) {
  if (cache !== undefined) {
    var _id = model._id;
    if (_id !== undefined && _id !== null) {
      if (_id instanceof ObjectID) {
        cache.del('_id:' + _id.toHexString());
      }
    }
    if (indexes !== undefined && indexes !== null) {
      var i;
      for (i = 0; i < indexes.length; i++) {
        cache.del(indexes[i] + ':' + model[indexes[i]]);
      }
    }
    cache.del('::all');
  }
}

module.exports = function (mongoCollection, l2cache) {

  var odm = this;

  var cache = l2cache ? new Cache({cacheSize: 1024, ttl: 300000}) : undefined;

  var Model = function () {
    throw new Error('Documents are read only and cannot be instantiated');
  };

  Model.findOne = function (query, fields, options, callback) {

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

    odm.findOne(mongoCollection, query, fields, options, callback);
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

    odm.find(mongoCollection, query, fields, options, callback);
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
    var cachedDocuments = isCached(cache, '', 'all');

    if (cachedDocuments !== undefined) {
      return callback(null, cachedDocuments);
    }

    odm.find(mongoCollection, {}, fields, options, function (err, documentsLoaded) {
      if (err) {
        return callback(err);
      }

      putToCache(cache, '', 'all', documentsLoaded);

      return callback(null, documentsLoaded);
    });
  };


  /**
   * Save this object instance to the backend mongodb instance.
   *
   * @memberOf Model
   * @param {Object} document Document to store
   * @param {Object|Function} [options] options for the query
   * @param {Function} callback Callback function (error, documentId) with the result of the operation
   */
  Model.save = function (document, options, callback) {
    if (callback === undefined) {
      callback = options;
      options = {};
    }

    odm.save(mongoCollection, document, options, function (err, savedDocument) {
      if (err) {
        return callback(err);
      }
      // only inserts have savedDocument
      if (savedDocument) {
        document._id = savedDocument._id;
      }
      // document updated delete from cache since it is not valid anymore
      purgeCache(cache, Model.IndexKeys, document);
      callback(null, document._id);
    });
  };
  /**
   * Remove this object instance from the backend mongodb instance.
   *
   * @memberOf Model
   * @param {Object} query Search query of objects to remove
   * @param {Object|Function} [options] options for the query
   * @param {Function} callback Callback function (error) with the result of the operation
   */
  Model.remove = function (query, options, callback) {
    if (callback === undefined) {
      callback = options;
      options = {};
    }

    odm.remove(mongoCollection, query, options, function (err) {
      // document deleted, delete from cache since it is not valid anymore
      if (cache !== undefined) {
        cache.reset();
      }
      callback(err);
    });
  };

  /**
   * Ensure indexes are present
   *
   * @param fieldOrSpec
   * @param [options]
   * @param callback
   */
  Model.ensureIndex = function (fieldOrSpec, options, callback) {

    if (callback === undefined) {
      callback = options;
      options = {};
    }

    var indexFields = Object.keys(fieldOrSpec);

    if (indexFields.length === 1) {
      var field = indexFields[0];
      // only create special finder if the index is not on a sub document
      if (field.indexOf('.') === -1) {
        // create special find with cache method
        var methodName = 'findBy' + field.substr(0, 1).toUpperCase() + field.substr(1);

        Model[methodName] = function (id, fields, options, callback) {
          if (callback === undefined) {
            if (options === undefined) {
              callback = fields;
              options = {};
              fields = {};
            } else {
              callback = options;
              options = fields;
              fields = {};
            }
          }

          if (id === undefined) {
            return callback('undefined id');
          }

          var includeNotFound = true;

          if (options.unique !== undefined && options.unique === true) {
            includeNotFound = false;
          }

          var cachedDocument = isCached(cache, field, id);

          if (cachedDocument !== undefined) {

            // if we search for an Id and get null return right away
            if (cachedDocument === null) {
              if (includeNotFound) {
                return callback(null, null);
              } else {
                return callback(mongoCollection + ' ' + id + ' not found');
              }
            }

            return callback(null, cachedDocument);
          }

          var query = {};
          query[field] = id;

          odm.findOne(mongoCollection, query, fields, options, function (err, documentLoaded) {
            if (err) {
              return callback(err);
            }

            putToCache(cache, field, id, documentLoaded);

            // if we search for an Id and get null it should return right away
            if (documentLoaded === null) {
              if (includeNotFound) {
                return callback(null, null);
              } else {
                return callback(mongoCollection + ' ' + id + ' not found');
              }
            }

            callback(null, documentLoaded);
          });
        };

        // add entry to the index keys
        Model.IndexKeys.push(field);
      }
    }

    odm.collection(mongoCollection, options, function (err, collection) {
      if (err) {
        return callback(err);
      }

      collection.ensureIndex(fieldOrSpec, options, callback);
    });
  };

  Object.defineProperty(Model, 'IndexKeys', {value: []});

  return Model;
};