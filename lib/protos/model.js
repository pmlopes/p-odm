/**
 * This module contains functions related to Object Document Mapping between JavaScript and MongoDB.
 *
 * @author <a href="mailto:plopes@roughcookie.com">Paulo Lopes</a>
 */
'use strict';

/** @private */
var mongodb = require('mongodb');
/** @private */
var ObjectId = mongodb.BSONPure.ObjectID;
/** @private */
var objectIdRegExp = /^[0-9a-fA-F]{24}$/;
/** @private */
var common = require('./common');

var extractOption = common.extractOption;
var getOption = common.getOption;

/**
 * @private
 * @readonly
 * @const
 *
 * @type {String}
 */
var PROTO = '__proto__';

/**
 * Creates a new Model class
 *
 * @param {ODM} odm ODM module
 * @param {String} [mongoCollection] Collection name, if not present this is an embedded document
 *
 * @return {Function}
 */
function modelClassGenerator(odm, mongoCollection) {

  if (mongoCollection === undefined) {
    throw new Error('No Mongo Collection supplied');
  }

  /**
   * Document Customized class for a mongodb document schema.
   * @global
   * @name Model
   * @constructor
   */
  var Model = function () {
  };

  /**
   * mongo collection
   * @memberOf Model
   */
  Object.defineProperty(Model, '$collection', {value: mongoCollection});

  /**
   * Finds one element of this collection by the given query.
   *
   * @static
   * @memberOf Model
   * @param {Object} query Query object as in mongodb documentation
   * @param {Object} [fields] filter fields
   * @param {Object} [options] Query options, such as skip, limit, etc
   * @param {Function} callback Callback function (error, model) with the result of the operation
   */
  Model.findOne = function (query, fields, options, callback) {
    var hasFields = true;

    if (callback === undefined) {
      if (options === undefined) {
        callback = fields;
        options = {};
        fields = {};
        hasFields = false;
      } else {
        callback = options;
        options = fields;
        fields = {};
        hasFields = false;
      }
    }

    var pluck = extractOption('pluck', options);

    if (pluck !== undefined) {
      // state that we only care about the plucked field
      fields[pluck] = true;
      hasFields = true;
    }

    var random = extractOption('random', options);

    if (random) {
      return odm.count(mongoCollection, query, options, function (err, count) {
        if (err) {
          return callback(err);
        }

        options.limit = -1;
        options.skip = count * Math.random();

        return odm.findOne(mongoCollection, query, fields, options, function (err, documentLoaded) {
          if (err) {
            return callback(err);
          }

          if (documentLoaded === null) {
            return callback(null, null);
          }

          if (hasFields) {
            if (pluck !== undefined) {
              documentLoaded = documentLoaded[pluck];
            }
            return callback(null, documentLoaded);
          }

          // enhance the DB document do have ODM features
          documentLoaded[PROTO] = Model.prototype;
          return callback(null, documentLoaded);
        });
      });
    }

    return odm.findOne(mongoCollection, query, fields, options, function (err, documentLoaded) {
      if (err) {
        return callback(err);
      }

      if (documentLoaded === null) {
        return callback(null, null);
      }

      if (hasFields) {
        if (pluck !== undefined) {
          documentLoaded = documentLoaded[pluck];
        }
        return callback(null, documentLoaded);
      }

      // enhance the DB document do have ODM features
      documentLoaded[PROTO] = Model.prototype;
      return callback(null, documentLoaded);
    });
  };

  /**
   * Finds one element of this collection given its Id.
   *
   * @static
   * @memberOf Model
   * @param {ObjectId|String} id Either a ObjectId instance or, the function will try to cast it to ObjectId.
   * @param {Object} [fields] filter fields
   * @param {Object} [options] Query options, such as skip, limit, etc
   * @param {Function} callback Callback function (error, model) with the result of the operation
   */
  Model.findById = function (id, fields, options, callback) {
    var hasFields = true;

    if (callback === undefined) {
      if (options === undefined) {
        callback = fields;
        options = {};
        fields = {};
        hasFields = false;
      } else {
        callback = options;
        options = fields;
        fields = {};
        hasFields = false;
      }
    }

    var pluck = extractOption('pluck', options);

    if (pluck !== undefined) {
      // state that we only care about the plucked field
      fields[pluck] = true;
      hasFields = true;
    }

    if (id === undefined) {
      return callback('undefined id');
    }

    var _id;

    if (id instanceof ObjectId) {
      _id = id;
    } else {
      if (typeof id === 'string' && id.length === 24 && objectIdRegExp.test(id)) {
        _id = ObjectId.createFromHexString(id);
      } else {
        return callback('invalid object id');
      }
    }

    return odm.findOne(mongoCollection, {_id: _id}, fields, options, function (err, documentLoaded) {
      if (err) {
        return callback(err);
      }

      // if we search for an Id and get null it should return right away
      if (documentLoaded === null) {
        return callback(mongoCollection + ' ' + _id.toHexString() + ' not found');
      }

      if (hasFields) {
        if (pluck !== undefined) {
          documentLoaded = documentLoaded[pluck];
        }
        return callback(null, documentLoaded);
      }

      // enhance the DB document do have ODM features
      documentLoaded[PROTO] = Model.prototype;
      return callback(null, documentLoaded);
    });
  };

  /**
   * Free form find in collection. The result is returned as a Array of this model objects.
   *
   * @static
   * @memberOf Model
   * @param {Object} query MongoDB Query
   * @param {Object} [fields] filter the fields to be returned
   * @param {Object} [options] options for the query
   * @param {Function} callback Callback function (error, model) with the result of the operation
   */
  Model.find = function (query, fields, options, callback) {
    var hasFields = true;

    if (callback === undefined) {
      if (options === undefined) {
        callback = fields;
        options = {};
        fields = {};
        hasFields = false;
      } else {
        callback = options;
        options = fields;
        fields = {};
        hasFields = false;
      }
    }

    var count = extractOption('count', options);

    if (count) {
      return odm.count(mongoCollection, query, options, callback);
    }

    var pluck = extractOption('pluck', options);
    var wantCursor = getOption('cursor', options);

    if (pluck !== undefined) {
      // state that we only care about the plucked field
      fields[pluck] = true;
      hasFields = true;
    }

    return odm.find(mongoCollection, query, fields, options, function (err, documentsLoaded) {
      if (err) {
        return callback(err);
      }

      if (wantCursor) {
        return callback(null, documentsLoaded);
      }

      var i, len;
      if (hasFields) {
        if (pluck !== undefined) {
          for (i = 0, len = documentsLoaded.length; i < len; i++) {
            documentsLoaded[i] = documentsLoaded[i][pluck];
          }
        }
        return callback(null, documentsLoaded);
      }

      for (i = 0, len = documentsLoaded.length; i < len; i++) {
        // enhance the DB document do have ODM features
        documentsLoaded[i][PROTO] = Model.prototype;
      }
      return callback(null, documentsLoaded);
    });
  };

  /**
   * Finds all elements in this collection.
   *
   * @static
   * @memberOf Model
   * @param {Object} [fields] filter the fields to be returned
   * @param {Object} [options] options for the query
   * @param {Function} callback Callback function (error, model) with the result of the operation
   */
  Model.findAll = function (fields, options, callback) {
    Model.find({}, fields, options, callback);
  };

  /**
   * Counts all elements in this collection.
   *
   * @static
   * @memberOf Model
   * @param {Object} [query] filter the fields to be returned
   * @param {Object} [options] options for the query
   * @param {Function} callback Callback function (error, model) with the result of the operation
   */
  Model.count = function (query, options, callback) {
    if (callback === undefined) {
      if (options === undefined) {
        callback = query;
        query = {};
        options = {};
      } else {
        callback = options;
        options = query;
        query = {};
      }
    }
    odm.count(mongoCollection, query, options, callback);
  };

  /**
   * Loads documents referenced by id/ids. This is a helper function that calls internally find or findById
   * with the correct parameters. The order of the return is guaranteed, while with a find it is not.
   *
   * @static
   * @memberOf Model
   * @param {ObjectId|ObjectId[]} ids single or array of ObjectId objects
   * @param {Object} [fields] filter the fields to be returned
   * @param {Object} [options] options for the query
   * @param {Function} callback Callback function (error, model) with the result of the operation
   */
  Model.loadDbRef = function (ids, fields, options, callback) {
    var hasFields = true;

    if (callback === undefined) {
      if (options === undefined) {
        callback = fields;
        options = {};
        fields = {};
        hasFields = false;
      } else {
        callback = options;
        options = fields;
        fields = {};
        hasFields = false;
      }
    }

    // special case when the property does not exist
    if (ids === undefined) {
      callback(null, []);
    }

    if (!Array.isArray(ids)) {
      return Model.findById(ids, options, callback);
    }

    var pluck = extractOption('pluck', options);

    if (pluck !== undefined) {
      // state that we only care about the plucked field
      fields[pluck] = true;
      hasFields = true;
    }

    if (ids.length === 0) {
      return callback(null, []);
    }

    // convert the orig array to an index
    var index = {};
    var i, len;
    var idsToFind = [];

    for (i = 0, len = ids.length; i < len; i++) {
      if (!(ids[i] instanceof ObjectId)) {
        return callback('Non ObjectId in the array');
      }

      // build index for the missing data
      if (index[ids[i].toHexString()] === undefined) {
        index[ids[i].toHexString()] = [i];
        idsToFind.push(ids[i]);
      } else {
        index[ids[i].toHexString()].push(i);
      }
    }

    // no items to search
    if (idsToFind.length === 0) {
      return callback(null, []);
    }

    return odm.find(mongoCollection, {_id: {'$in': idsToFind}}, fields, options, function (err, documentsLoaded) {
      if (err) {
        return callback(err);
      }

      var i, j, lenI, lenJ;
      var result = [];

      // using the index we have O(2n) complexity
      for (i = 0, lenI = documentsLoaded.length; i < lenI; i++) {
        var indexes = index[documentsLoaded[i]._id.toHexString()];
        for (j = 0, lenJ = indexes.length; j < lenJ; j++) {

          if (hasFields) {
            if (pluck !== undefined) {
              result[indexes[j]] = documentsLoaded[i][pluck];
            }
          } else {
            result[indexes[j]] = documentsLoaded[i];
            result[indexes[j]][PROTO] = Model.prototype;
          }
        }
      }

      return callback(null, result);
    });
  };

  /**
   * Ensure indexes are present
   *
   * @static
   * @memberOf Model
   * @param {Object} fieldOrSpec
   * @param {Object} [options]
   * @param {Function} callback
   */
  Model.ensureIndex = function (fieldOrSpec, options, callback) {
    if (callback === undefined) {
      callback = options;
      options = {};
    }

    var indexFields = Object.keys(fieldOrSpec);
    var generateFinder = options.generateFinder === undefined || options.generateFinder === true;

    if (generateFinder && indexFields.length === 1) {
      var field = indexFields[0];
      // only create special finder if the index is not on a sub document
      if (field.indexOf('.') === -1) {
        // create special find with cache method
        var methodName = 'findBy' + field.substr(0, 1).toUpperCase() + field.substr(1);

        var isUnique = false;

        if (options.unique !== undefined && options.unique === true) {
          isUnique = true;
        }

        Model[methodName] = function (id, fields, options, callback) {
          if (id === undefined) {
            return callback('undefined id');
          }

          var query = {};
          query[field] = id;

          if (isUnique) {
            return Model.findOne(query, fields, options, callback);
          }
          return Model.find(query, fields, options, callback);
        };
      }
    }

    odm.collection(mongoCollection, options, function (err, collection) {
      if (err) {
        return callback(err);
      }

      return collection.ensureIndex(fieldOrSpec, options, callback);
    });
  };

  /**
   * Save this object instance to the backend mongodb instance.
   *
   * @memberOf Model.prototype
   * @param {Object} [options] options for the query
   * @param {Function} callback Callback function (error, documentId) with the result of the operation
   */
  Model.prototype.save = function (options, callback) {
    if (callback === undefined) {
      callback = options;
      options = {};
    }

    var self = this;

    odm.save(mongoCollection, self, options, function (err, savedDocument) {
      if (err) {
        return callback(err);
      }
      // only inserts have savedDocument
      if (self._id === undefined) {
        if (savedDocument) {
          self._id = savedDocument._id;
        }
      }
      return callback(null, self._id);
    });
  };

  /**
   * Update this object instance to the backend mongodb instance.
   *
   * @memberOf Model.prototype
   * @param {Object} [partUpdate] partial update
   * @param {Object} [options] options for the query
   * @param {Function} callback Callback function (error, documentId) with the result of the operation
   */
  Model.prototype.update = function (partUpdate, options, callback) {
    if (callback === undefined) {
      if (options === undefined) {
        callback = partUpdate;
        options = {};
        partUpdate = undefined;
      } else {
        callback = options;
        options = {};
      }
    }

    var self = this;

    if (partUpdate !== undefined) {
      var setPath = extractOption('$setpath', partUpdate);
      if (setPath) {
        var path, i, len, result;
        if (Array.isArray(setPath)) {
          var j, len0;

          for (j = 0, len0 = setPath.length; j < len0; j++) {
            if (typeof setPath[j] === 'string') {
              path = setPath[j].split('.');
              result = self;
              for (i = 0, len = path.length; i < len; i++) {
                result = result[path[i]];
              }
              if (partUpdate.$set === undefined || partUpdate.$set === null) {
                partUpdate.$set = {};
              }
              partUpdate.$set[setPath[j]] = result;
            } else {
              return callback('$setpath only accepts a String path');
            }
          }
        } else {
          if (typeof setPath === 'string') {
            path = setPath.split('.');
            result = self;
            for (i = 0, len = path.length; i < len; i++) {
              result = result[path[i]];
            }
            if (partUpdate.$set === undefined || partUpdate.$set === null) {
              partUpdate.$set = {};
            }
            partUpdate.$set[setPath] = result;
          } else {
            return callback('$setpath only accepts a String path');
          }
        }
      }
    }

    return odm.update(mongoCollection, {_id: self._id}, partUpdate !== undefined ? partUpdate : self, options, callback);
  };

  /**
   * Insert this object instance to the backend mongodb instance.
   *
   * @memberOf Model.prototype
   * @param {Object} [options] options for the query
   * @param {Function} callback Callback function (error, documentId) with the result of the operation
   */
  Model.prototype.insert = function (options, callback) {
    if (callback === undefined) {
      callback = options;
      options = {};
    }

    odm.insert(mongoCollection, this, options, callback);
  };

  /**
   * Remove this object instance from the backend mongodb instance.
   *
   * @memberOf Model.prototype
   * @param {Object} [options] options for the query
   * @param {Function} callback Callback function (error) with the result of the operation
   */
  Model.prototype.remove = function (options, callback) {
    if (callback === undefined) {
      callback = options;
      options = {};
    }

    odm.remove(mongoCollection, {_id: this._id}, options, callback);
  };

  /**
   * @memberOf Model.prototype
   * @param {Object} options
   * @param {Function} callback
   */
  Model.prototype.reload = function (options, callback) {
    if (callback === undefined) {
      callback = options;
      options = {};
    }

    var self = this;
    var _id = self._id;

    if (!(_id instanceof ObjectId)) {
      return callback('cannot reload a non stored model');
    }

    return Model.findById(_id, options, function (err, documentLoaded) {
      if (err) {
        return callback(err);
      }

      // remove old references
      var key;
      for (key in self) {
        if (self.hasOwnProperty(key)) {
          delete self[key];
        }
      }
      // update new ones
      for (key in documentLoaded) {
        if (documentLoaded.hasOwnProperty(key)) {
          self[key] = documentLoaded[key];
        }
      }

      return callback(null);
    });
  };

  /**
   * Creates a snapshot of this object instance.
   *
   * @param {Object} [fields]
   * @param {Object} [options]
   * @param {Function} callback
   */
  Model.prototype.snapshot = function (fields, options, callback) {
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

    odm.snapshot(mongoCollection, this._id, fields, options, callback);
  };

  /**
   * Revert this object back to the last snapshot.
   *
   * @param {Object} [options]
   * @param {Function} callback
   */
  Model.prototype.revert = function (options, callback) {
    if (callback === undefined) {
      callback = options;
      options = {};
    }

    var self = this;
    var oid = self._id;

    odm.revert(mongoCollection, oid, options, function (err) {
      if (err) {
        return callback(err);
      }

      return self.reload(options, callback);
    });
  };

  /**
   * Commits the last snapshot.
   *
   * @param {Object} [options]
   * @param {Function} callback
   */
  Model.prototype.flush = function (options, callback) {
    if (callback === undefined) {
      callback = options;
      options = {};
    }

    odm.flush(mongoCollection, this._id, options, callback);
  };

  /**
   * Remove this object instance from the backend mongodb instance.
   *
   * @static
   * @memberOf Model
   * @param {Object} query Search query of objects to remove
   * @param {Object} [options] options for the query
   * @param {Function} callback Callback function (error) with the result of the operation
   */
  Model.remove = function (query, options, callback) {
    if (callback === undefined) {
      callback = options;
      options = {};
    }

    odm.remove(mongoCollection, query, options, callback);
  };

  /**
   * Save this object instance to the backend mongodb instance.
   *
   * @static
   * @memberOf Model
   * @param {Object} document document to save
   * @param {Object|Function} [options] options for the query
   * @param {Function} callback Callback function (error, documentId) with the result of the operation
   */
  Model.save = function (document, options, callback) {
    if (callback === undefined) {
      callback = options;
      options = {};
    }

    odm.save(mongoCollection, document, options, callback);
  };

  /**
   * Insert this object instance to the backend mongodb instance.
   *
   * @static
   * @memberOf Model
   * @param {Object} document document to insert
   * @param {Object} [options] options for the query
   * @param {Function} callback Callback function (error, documentId) with the result of the operation
   */
  Model.insert = function (document, options, callback) {
    if (callback === undefined) {
      callback = options;
      options = {};
    }

    odm.insert(mongoCollection, document, options, callback);
  };

  /**
   * Remove this object instance from the backend mongodb instance.
   *
   * @static
   * @memberOf Model
   * @param {Object} query Search query of objects to remove
   * @param {Object} document document to update the existing one
   * @param {Object} [options] options for the query
   * @param {Function} callback Callback function (error) with the result of the operation
   */
  Model.update = function (query, document, options, callback) {
    if (callback === undefined) {
      callback = options;
      options = {};
    }

    odm.update(mongoCollection, query, document, options, callback);
  };

  /**
   * Prepares a find statement to run in parallel mode.
   *
   * @param {Object} query
   * @param {Object} [fields]
   * @param {Object} [options]
   * @return {Object} finder object
   */
  Model.prepareFindOne = function (query, fields, options) {
    return {fn: Model.findOne, query: query, fields: fields, options: options};
  };

  /**
   * Prepares a find statement to run in parallel mode.
   *
   * @param {ObjectId} id
   * @param {Object} [fields]
   * @param {Object} [options]
   * @return {Object} finder object
   */
  Model.prepareFindById = function (id, fields, options) {
    return {fn: Model.findById, query: id, fields: fields, options: options};
  };

  /**
   * Prepares a find statement to run in parallel mode.
   *
   * @param {Object} query
   * @param {Object} [fields]
   * @param {Object} [options]
   * @return {Object} finder object
   */
  Model.prepareFind = function (query, fields, options) {
    return {fn: Model.find, query: query, fields: fields, options: options};
  };

  /**
   * Prepares a find statement to run in parallel mode.
   *
   * @param {Object} [fields]
   * @param {Object} [options]
   * @return {Object} finder object
   */
  Model.prepareFindAll = function (fields, options) {
    return {fn: Model.find, query: {}, fields: fields, options: options};
  };

  return Model;
}

module.exports = modelClassGenerator;