'use strict';

/**
 * This module contains functions related to Object Document Mapping between JavaScript and MongoDB.
 *
 * @author <a href="mailto:plopes@roughcookie.com">Paulo Lopes</a>
 * @version 2.0
 */
var mongodb = require('mongodb');

var schema = require('./schema');

var ObjectID = mongodb.BSONPure.ObjectID;
var Binary = mongodb.BSONPure.Binary;

var objectIdRegExp = new RegExp("^[0-9a-fA-F]{24}$");

/**
 * Extracts one option from the object and returns it.
 * @private
 */
function extractOption(name, options) {
  var option;
  if (options) {
    if (options.hasOwnProperty(name)) {
      option = options[name];
      delete options[name];
    }
  }
  return option;
}

function extend(obj, proto) {
  for (var key in proto) {
    if (obj !== undefined && obj !== null) {
      if (proto.hasOwnProperty(key)) {
        if (typeof proto[key] === 'object') {
          if (obj.hasOwnProperty(key)) {
            // if type is object and obj has it too, recurse
            extend(obj[key], proto[key]);
          }
        } else {
          if (typeof obj === 'object') {
            if (obj[key] === undefined) {
              // set it if not defined in the object
              if (Array.isArray(obj)) {
                var i;
                for (i = 0; i < obj.length; i++) {
                  Object.defineProperty(obj[i], key, {value: proto[key]});
                }
              } else {
                Object.defineProperty(obj, key, {value: proto[key]});
              }
            }
          }
        }
      }
    }
  }
}

/**
 * Creates a new Document Model class
 *
 * @memberOf ODM
 * @param {String} [mongoCollection] Collection name, if not present this is an embedded document
 * @param {Object} schemaDef Schema definition
 *
 * @return {Model}
 */
module.exports = function (mongoCollection, schemaDef) {

  if (schemaDef === undefined) {
    schemaDef = mongoCollection;
    mongoCollection = undefined;
  }

  /**
   * @name Model
   * @class Document Model Customized class for a mongodb document schema.
   */
  var Model = function () {
  };

  /**
   * schema for embedded objects
   *
   * @memberOf Model
   */
  Object.defineProperty(Model, '$schema', {value: schema.compile(schemaDef)});

  var odm = this;

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

    if (!mongoCollection) {
      return callback('Cannot findOne on embedded model');
    }

    odm.findOne(mongoCollection, query, fields, options, function (err, documentLoaded) {
      if (err) {
        return callback(err);
      }

      if (documentLoaded === null) {
        return callback(null, null);
      }

      extend(documentLoaded, Model.prototype);
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

    if (!mongoCollection) {
      return callback('Cannot findById on embedded model');
    }

    if (id === undefined) {
      return callback('undefined id');
    }

    var _id;
    var includeNotFound = extractOption('includeNotFound', options);

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
        if (includeNotFound) {
          return callback(null, null);
        } else {
          return callback(mongoCollection + ' ' + _id.toHexString() + ' not found');
        }
      }

      extend(documentLoaded, Model.prototype);
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

    if (!mongoCollection) {
      return callback('Cannot find on embedded model');
    }

    var pluck = extractOption('pluck', options);

    if (pluck !== undefined) {
      // state that we only care about the plucked field
      fields[pluck] = true;
    }

    odm.find(mongoCollection, query, fields, options, function (err, documentsLoaded) {
      if (err) {
        return callback(err);
      }
      var i;
      for (i = 0; i < documentsLoaded.length; i++) {
        extend(documentsLoaded[i], Model.prototype);
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

    if (!mongoCollection) {
      return callback('Cannot ensureIndex on embedded model');
    }

    var indexFields = Object.keys(fieldOrSpec);

    if (indexFields.length === 1) {
      var field = indexFields[0];
      // only create special finder if the index is not on a sub document
      if (field.indexOf('.') === -1) {
        // create special find with cache method
        var methodName = 'findBy' + field.substr(0, 1).toUpperCase() + field.substr(1);
        var valid = Model.$schema[field].$validate;

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

          if (!mongoCollection) {
            return callback('Cannot ' + methodName + ' on embedded model');
          }

          if (id === undefined) {
            return callback('undefined id');
          }

          var includeNotFound = true;

          if (options.unique !== undefined && options.unique === true) {
            includeNotFound = false;
          }

          var _id;

          try {
            _id = valid(id);
          } catch (ex) {
            return callback(ex);
          }

          var query = {};
          query[field] = _id;

          odm.findOne(mongoCollection, query, fields, options, function (err, documentLoaded) {
            if (err) {
              return callback(err);
            }

            // if we search for an Id and get null it should return right away
            if (documentLoaded === null) {
              if (includeNotFound) {
                return callback(null, null);
              } else {
                return callback(mongoCollection + ' ' + _id + ' not found');
              }
            }

            extend(documentLoaded, Model.prototype);
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

    if (!mongoCollection) {
      return callback('Cannot save on embedded model');
    }

    var self = this;

    try {
      schema.validate(Model.$schema, self, mongoCollection);
    } catch(ex) {
      return callback(ex);
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

    if (!mongoCollection) {
      return callback('Cannot update on embedded model');
    }

    var self = this;

    try {
      schema.validate(Model.$schema, self, mongoCollection);
    } catch(ex) {
      return callback(ex);
    }

    if (partUpdate !== undefined) {
      var setPath = extractOption('$setpath', partUpdate);
      if (setPath) {
        var path = setPath.split('.');
        var i;
        var result = self;
        for(i = 0; i < path.length; i++) {
          result = result[path[i]];
        }
        if (partUpdate.$set === undefined || partUpdate.$set === null) {
          partUpdate.$set = {};
        }
        partUpdate.$set[setPath] = result;
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

    if (!mongoCollection) {
      return callback('Cannot insert on embedded model');
    }

    var self = this;

    try {
      schema.validate(Model.$schema, self, mongoCollection);
    } catch(ex) {
      return callback(ex);
    }

    odm.insert(mongoCollection, self, options, callback);
  };

  /**
   * Remove this object instance from the backend mongodb instance.
   *
   * @memberOf Model
   * @param {Object|Function} [options] options for the query
   * @param {Function} callback Callback function (error) with the result of the operation
   */
  Model.prototype.remove = function (options, callback) {
    if (callback === undefined) {
      callback = options;
      options = {};
    }

    if (!mongoCollection) {
      return callback('Cannot remove on embedded model');
    }

    var self = this;

    odm.remove(mongoCollection, {_id: self._id}, options, callback);
  };

  Model.prototype.reload = function (callback) {
    if (!mongoCollection) {
      return callback('Cannot remove on embedded model');
    }

    var self = this;
    var _id = self._id;

    if (!(_id instanceof ObjectID)) {
      return callback('cannot reload a non stored model');
    }

    Model.findById(_id, function (err, documentLoaded) {
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

      callback(null);
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

    if (!mongoCollection) {
      return callback('Cannot remove on embedded model');
    }

    odm.remove(mongoCollection, query, options, callback);
  };

  /**
   * Remove this object instance from the backend mongodb instance.
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

    if (!mongoCollection) {
      return callback('Cannot remove on embedded model');
    }

    odm.update(mongoCollection, query, document, options, callback);
  };

  /**
   * Clones the Type prototype to this model class
   * @param path {String} Path to be updated
   * @param type {Object} Type prototype to be copied
   */
  Model.embeds = function (path, type) {
    var protokey;
    for (protokey in type.prototype) {
      if (protokey !== 'save' && protokey !== 'update' && protokey !== 'insert' && protokey !== 'remove' && protokey !== 'reload') {
        if (type.prototype.hasOwnProperty(protokey)) {
          path = path.split('.');
          var i;
          var result = Model.prototype;
          for(i = 0; i < path.length; i++) {
            var key = path[i];
            if (!result.hasOwnProperty(key)) {
              result[key] = {};
            }
            result = result[path[i]];
          }
          result[protokey] = type.prototype[protokey];
        }
      }
    }
  };

  return Model;
};
