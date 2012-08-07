'use strict';

/**
 * This module contains functions related to Object Document Mapping between JavaScript and MongoDB.
 *
 * @author <a href="mailto:plopes@roughcookie.com">Paulo Lopes</a>
 * @version 2.0
 */
var mongodb = require('mongodb');

var ObjectID = mongodb.BSONPure.ObjectID;

var objectIdRegExp = /^[0-9a-fA-F]{24}$/;

var baseModel = require('./freemodel');

/**
 * Extracts one option from the object and returns it.
 * @private
 */
function extractOption(name, options, defaultValue) {
  var option = defaultValue;
  if (options) {
    if (options.hasOwnProperty(name)) {
      option = options[name];
      delete options[name];
    }
  }
  return option;
}

/**
 * Creates a new Document Model class
 *
 * @memberOf ODM
 * @param {ODM} odm ODM module
 * @param {String} mongoCollection Collection name, if not present this is an embedded document
 * @param {Object} schemaDef Schema definition
 *
 * @return {Model}
 */
module.exports = function (odm, mongoCollection, schemaDef) {

  /**
   * @name Model
   * @class Document Model Customized class for a mongodb document schema.
   * @param {Object} [json] if provided will update the current instance with the json properties
   */
  var Model = function (json) {
    if (this instanceof Model) {
      // new instance
      if (json !== undefined && json !== null) {
        var key;
        for (key in json) {
          if (json.hasOwnProperty(key)) {
            this[key] = json[key];
          }
        }
      }
    } else {
      // cast
      if (json !== undefined && json !== null) {
        json.__proto__ = Model.prototype;
      }
      return json;
    }
  };

  /**
   * schema for embedded objects
   *
   * @memberOf Model
   */
  Object.defineProperty(Model, '$schema', {value: odm.createSchema(schemaDef)});

  /**
   * Keep track of embeds (it is similar to prototype)
   */
  Object.defineProperty(Model, '$embeds', {value: []});

  /**
   * Verifies if an Object is valid against the configured validator
   *
   * @param {Boolean} [verbose]
   * @return {Boolean|Object}
   */
  Model.prototype.validate = function (verbose) {
    var validation = odm.validate(this, Model.$schema);
    if (Array.isArray(validation)) {
      if (validation.length > 0) {
        if (verbose === true) {
          return validation;
        } else {
          return false;
        }
      }
    }

    // if no schema, always OK
    if (verbose === true) {
      return null;
    } else {
      return true;
    }
  };

  /**
   * Helper to have a short syntax
   *
   * @return {Boolean}
   */
  Model.prototype.isValid = function () {
    return this.validate();
  };

  /**
   * Clones the Type prototype to this model class
   * @param path {String} Path to be updated
   * @param type {Object} Type prototype to be copied
   */
  Model.embeds = function (path, type) {
    Model.$embeds.push({path: path, type: type});
  };

  var BaseModel = baseModel(odm, mongoCollection);

  /**
   * Finds one element of this collection by the given query.
   *
   * @memberOf Model
   * @param {Object} query Query object as in mongodb documentation
   * @param {Object|Function} [fields] filter fields
   * @param {Object|Function} [options] Query options, such as skip, limit, etc
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

    var wantExtend = extractOption('extend', options, true);
    var pluck = extractOption('pluck', options);

    if (pluck !== undefined) {
      // state that we only care about the plucked field
      fields[pluck] = true;
      hasFields = true;
    }

    odm.findOne(mongoCollection, query, fields, options, function (err, documentLoaded) {
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
      } else {
        if (wantExtend) {
          documentLoaded.__proto__ = Model.prototype;
        } else {
          documentLoaded.__proto__ = BaseModel.prototype;
        }
      }

      callback(null, documentLoaded);
    });
  };

  /**
   * Finds one element of this collection given its Id.
   *
   * @memberOf Model
   * @param {ObjectID|String} id Either a ObjectId instance or, the function will try to cast it to ObjectId.
   * @param {Object|Function} [fields] filter fields
   * @param {Object|Function} [options] Query options, such as skip, limit, etc
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

    var wantExtend = extractOption('extend', options, true);
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

    if (id instanceof ObjectID) {
      _id = id;
    } else {
      if (typeof id === 'string' && id.length === 24 && objectIdRegExp.test(id)) {
        _id = ObjectID.createFromHexString(id);
      } else {
        return callback('invalid object id');
      }
    }

    odm.findOne(mongoCollection, {_id: _id}, fields, options, function (err, documentLoaded) {
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
      } else {
        if (wantExtend) {
          documentLoaded.__proto__ = Model.prototype;
        } else {
          documentLoaded.__proto__ = BaseModel.prototype;
        }
      }
      callback(null, documentLoaded);
    });
  };

  /**
   * Free form find in collection. The result is returned as a Array of this model objects.
   *
   * @memberOf Model
   * @param {Object} query MongoDB Query
   * @param {Object|Function} [fields] filter the fields to be returned
   * @param {Object|Function} [options] options for the query
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

    var wantExtend = extractOption('extend', options, true);
    var pluck = extractOption('pluck', options);

    if (pluck !== undefined) {
      // state that we only care about the plucked field
      fields[pluck] = true;
      hasFields = true;
    }

    odm.find(mongoCollection, query, fields, options, function (err, documentsLoaded) {
      if (err) {
        return callback(err);
      }

      var i, len;
      if (hasFields) {
        if (pluck !== undefined) {
          for (i = 0, len = documentsLoaded.length; i < len; i++) {
            documentsLoaded[i] = documentsLoaded[i][pluck];
          }
        }
      } else {
        if (wantExtend) {
          for (i = 0, len = documentsLoaded.length; i < len; i++) {
            documentsLoaded[i].__proto__ = Model.prototype;
          }
        } else {
          for (i = 0, len = documentsLoaded.length; i < len; i++) {
            documentsLoaded[i].__proto__ = BaseModel.prototype;
          }
        }
      }
      callback(null, documentsLoaded);
    });
  };

  /**
   * Finds all elements in this collection.
   *
   * @memberOf Model
   * @param {Object|Function} [fields] filter the fields to be returned
   * @param {Object|Function} [options] options for the query
   * @param {Function} callback Callback function (error, model) with the result of the operation
   */
  Model.findAll = function (fields, options, callback) {
    Model.find({}, fields, options, callback);
  };

  /**
   * Loads documents referenced by id/ids. This is a helper function that calls internally find or findById
   * with the correct parameters. The order of the return is guaranteed, while with a find it is not.
   *
   * @memberOf Model
   * @param {ObjectID|ObjectID[]} ids single or array of ObjectId objects
   * @param {Object|Function} [fields] filter the fields to be returned
   * @param {Object|Function} [options] options for the query
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
      return callback(null, []);
    }

    if (!Array.isArray(ids)) {
      return Model.findById(ids, fields, options, callback);
    }

    var wantExtend = extractOption('extend', options, true);
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
      if (!(ids[i] instanceof ObjectID)) {
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

    odm.find(mongoCollection, {_id: {'$in': idsToFind}}, fields, options, function (err, documentsLoaded) {
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

            if (wantExtend) {
              result[indexes[j]].__proto__ = Model.prototype;
            } else {
              result[indexes[j]].__proto__ = BaseModel.prototype;
            }
          }
        }
      }

      callback(null, result);
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

          var wantExtend = extractOption('extend', options, true);
          var pluck = extractOption('pluck', options);

          if (pluck !== undefined) {
            // state that we only care about the plucked field
            fields[pluck] = true;
            hasFields = true;
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

            if (hasFields) {
              if (pluck !== undefined) {
                documentLoaded = documentLoaded[pluck];
              }
            } else {
              if (wantExtend) {
                documentLoaded.__proto__ = Model.prototype;
              } else {
                documentLoaded.__proto__ = BaseModel.prototype;
              }
            }
            callback(null, documentLoaded);
          });
        };
      }
    }

    odm.collection(mongoCollection, options, function (err, collection) {
      if (err) {
        return callback(err);
      }

      collection.ensureIndex(fieldOrSpec, options, callback);
    });
  };

  /**
   * Save this object instance to the backend mongodb instance.
   *
   * @memberOf Model
   * @param {Object|Function} [options] options for the query
   * @param {Function} callback Callback function (error, documentId) with the result of the operation
   */
  Model.prototype.save = function (options, callback) {
    if (callback === undefined) {
      callback = options;
      options = {};
    }

    var self = this;

    var validation = self.validate(true);
    if (validation !== null) {
      return callback(validation);
    }

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
      callback(null, self._id);
    });
  };

  /**
   * Update this object instance to the backend mongodb instance.
   *
   * @memberOf Model
   * @param {Object|Function} [options] options for the query
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
    var validation;

    if (partUpdate !== undefined) {
      var setPath = extractOption('$setpath', partUpdate);
      if (setPath) {
        if (Array.isArray(setPath)) {
          var j, len0;
          var path, i, len, result;

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

        validation = self.validate(true);
        if (validation !== null) {
          return callback(validation);
        }
      }
    } else {
      validation = self.validate(true);
      if (validation !== null) {
        return callback(validation);
      }
    }

    odm.update(mongoCollection, {_id: self._id}, partUpdate !== undefined ? partUpdate : self, options, callback);
  };

  /**
   * Insert this object instance to the backend mongodb instance.
   *
   * @memberOf Model
   * @param {Object|Function} [options] options for the query
   * @param {Function} callback Callback function (error, documentId) with the result of the operation
   */
  Model.prototype.insert = function (options, callback) {
    if (callback === undefined) {
      callback = options;
      options = {};
    }

    var validation = this.validate(true);
    if (validation !== null) {
      return callback(validation);
    }

    odm.insert(mongoCollection, this, options, callback);
  };

  /**
   * Remove this object instance from the backend mongodb instance.
   *
   * @memberOf Model
   * @param {Object|Function} [options] options for the query
   * @param {Function} callback Callback function (error) with the result of the operation
   */
  Model.prototype.remove = BaseModel.prototype.remove;

  Model.prototype.reload = BaseModel.prototype.reload;

  /**
   * Remove this object instance from the backend mongodb instance.
   *
   * @memberOf Model
   * @param {Object} query Search query of objects to remove
   * @param {Object|Function} [options] options for the query
   * @param {Function} callback Callback function (error) with the result of the operation
   */
  Model.remove = BaseModel.remove;

  /**
   * Insert this object instance to the backend mongodb instance.
   *
   * @memberOf Model
   * @param {Object|Function} [options] options for the query
   * @param {Function} callback Callback function (error, documentId) with the result of the operation
   */
  Model.insert = BaseModel.insert;

  /**
   * Remove this object instance from the backend mongodb instance.
   *
   * @memberOf Model
   * @param {Object} query Search query of objects to remove
   * @param {Object|Function} [options] options for the query
   * @param {Function} callback Callback function (error) with the result of the operation
   */
  Model.update = BaseModel.update;

  return Model;
};
