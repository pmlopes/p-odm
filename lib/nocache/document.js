'use strict';

var mongodb = require('mongodb');
var ObjectID = mongodb.BSONPure.ObjectID;

module.exports = function (mongoCollection, l2cache) {

  var odm = this;

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

    odm.find(mongoCollection, {}, fields, options, function (err, documentsLoaded) {
      if (err) {
        return callback(err);
      }

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
      // document updated
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

    odm.remove(mongoCollection, query, options, callback);
  };

  /**
   * Update this object instance from the backend mongodb instance.
   *
   * @memberOf Model
   * @param {Object} query Search query of objects to remove
   * @param {Object|Function} [options] options for the query
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

          var query = {};
          query[field] = id;

          odm.findOne(mongoCollection, query, fields, options, function (err, documentLoaded) {
            if (err) {
              return callback(err);
            }

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