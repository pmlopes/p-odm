'use strict';

/**
 * This module contains functions related to Object Document Mapping between JavaScript and MongoDB.
 *
 * @author <a href="mailto:plopes@roughcookie.com">Paulo Lopes</a>
 * @version 1.0
 */
var mongodb = require('mongodb');
var ObjectID = mongodb.BSONPure.ObjectID;
var Binary = mongodb.BSONPure.Binary;

var Cache = require('./cache');

/**
 * @private
 */
function isSpecial(obj) {
  var key;
  for (key in obj) {
    if (obj.hasOwnProperty(key) && key.charAt(0) === '$') {
      return true;
    }
  }
  return false;
}

/**
 * @private
 * Initialize the model object with the data either from db or from user
 */
function initialize(schema, dbdata, collectionName) {
  var data, value, key;

  for (key in dbdata) {
    if (dbdata.hasOwnProperty(key)) {
      // skip functions
      if (typeof dbdata[key] === 'function') {
        continue;
      }

      if (schema.hasOwnProperty(key)) {
        // reset
        value = undefined;

        if (schema[key].$set !== undefined) {
          // this is a leaf (contains data)
          if (dbdata !== undefined && dbdata !== null) {
            value = schema[key].$set(dbdata[key]);
          }
        } else {
          // this is a branch (embedded document)
          value = initialize(schema[key], dbdata[key], collectionName);
        }

        // load or set if the db document contains the key
        if (value !== undefined) {
          if (data === undefined) {
            data = {};
          }
          data[key] = value;
        }
      } else {
        console.error(key + ' is not defined in the model [' + collectionName + ']');
      }
    }
  }

  return data;
}

// common instance prototype helpers
function isEmptyProto (obj) {
  if (obj !== undefined && obj !== null) {
    var keys = Object.keys(obj);

    if (keys.length !== 0) {
      var i;

      for (i = 0; i < keys.length; i++) {
        var prop = obj[keys[i]];
        if (Array.isArray(prop)) {
          if (prop.length !== 0) {
            return false;
          }
        } else if (typeof prop === 'object') {
          if (!isEmptyProto(prop)) {
            return false;
          }
        } else {
          return false;
        }
      }
    }
  }

  return true;
}

function hasOwnPropertyProto (obj, key) {
  if (obj === undefined || obj === null) {
    return true;
  }

  return obj.hasOwnProperty(key);
}

var submodelproto = {
  toJSON: function () {
    return this._internalDocument;
  },
  toString: function () {
    return JSON.stringify(this._internalDocument);
  },
  hasOwnProperty: function (key) {
    return hasOwnPropertyProto(this._internalDocument, key);
  },
  isEmpty: function () {
    return isEmptyProto(this._internalDocument);
  }
};

function matchValue(search, value, reverse) {
  var hasEquals = search.equals !== undefined && search.equals !== null && typeof(search.equals) === 'function';

  if (hasEquals) {
    if (reverse) {
      if (search.equals(value)) {
        return false;
      }
    } else {
      if (!search.equals(value)) {
        return false;
      }
    }
  } else {
    if (reverse) {
      if (search === value) {
        return false;
      }
    } else {
      if (search !== value) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Verify if the object matches the query
 * @param query
 * @param obj
 */
function matches(query, obj) {
  var keys = Object.keys(query);
  var i, j;

  for (i = 0; i < keys.length; i++) {
    var key = keys[i];
    var search = query[key];

    if (search === undefined || search === null) {
      return -1;
    }

    var negate = false;

    if (search.hasOwnProperty('$ne')) {
      negate = true;
      search = search.$ne;

      if (search === undefined || search === null) {
        return -1;
      }
    }

    var multi = false;

    if (search.hasOwnProperty('$in')) {
      multi = true;
      if (!Array.isArray(search.$in)) {
        return -2;
      }
      search = search.$in;

      if (search === undefined || search === null) {
        return -1;
      }
    }

    if (search.hasOwnProperty('$nin')) {
      multi = true;
      negate = true;
      if (!Array.isArray(search.$nin)) {
        return -2;
      }
      search = search.$nin;

      if (search === undefined || search === null) {
        return -1;
      }
    }

    if (obj.hasOwnProperty(key)) {
      if (multi) {
        var matched = false;
        for (j = 0; j < search.length; j++) {
          if (matchValue(search[j], obj[key], negate)) {
            matched = true;
            break;
          }
        }
        if (!matched) {
          return 0;
        }
      } else {
        if (!matchValue(search, obj[key], negate)) {
          return 0;
        }
      }
    } else {
      return 0;
    }
  }

  return 1;
}

/**
 * @private
 * @param schema document schema
 * @param model model of this document
 */
function buildValidator(schema, model) {

  /**
   * Extends a JS native Array to ODM specific Array
   *
   * ODM Arrays have find functions that relate to mongo API
   *
   * @param {Array} value the JS array to me enhanced
   * @param {Object} schema
   * @param {Object} model
   * @param {String} key
   */
  var odmArray = function (value, schema, model, key) {

    // wrap Array push function with validator
    if (!value.hasOwnProperty('push')) {
      Object.defineProperty(value, 'push', {
        value: function () {
          return schema[key].$push.call(model, model._internalDocument[key], arguments);
        }
      });
    }

    var Type = schema[key].$type;

    // if it is a array of embedded models
    if (Type !== undefined) {

      if (!value.hasOwnProperty('get')) {
        Object.defineProperty(value, 'get', {
          value: function (index) {

            var item = value[index];

            if (item !== undefined && item !== null) {
              var embeddedModel;

              if (Type.prototype !== undefined && Type.prototype !== null) {
                embeddedModel = Object.create(Type.prototype);
              } else {
                embeddedModel = Object.create(submodelproto);
              }

              // define the internal document
              Object.defineProperty(embeddedModel, '_internalDocument', {value: model._internalDocument[key][index]});
              // define a read only ref to the parent
              Object.defineProperty(embeddedModel, '$parent', {value: model});
              buildValidator(Type.internalSchema, embeddedModel);
              return embeddedModel;
            }

            return item;
          }
        });
      }

      if (!value.hasOwnProperty('set')) {
        Object.defineProperty(value, 'set', {
          value: function (index, item) {
            if (item !== undefined && item !== null) {
              if (item.toJSON !== undefined) {
                item = item.toJSON();
              }
              value[index] = item;
            }
          }
        });
      }

      // enhance arrays with basic findById
      if (!value.hasOwnProperty('findById')) {
        Object.defineProperty(value, 'findById', {
          value: function (id, options, callback) {

            if (callback === undefined) {
              callback = options;
              options = {};
            }

            try {
              var _id = (id instanceof ObjectID) ? id : new ObjectID(id);
              var i;

              for (i = 0; i < value.length; i++) {
                var el = value[i];
                if (el.hasOwnProperty('_id') && _id.equals(el._id)) {
                  if (options.directObject) {
                    return callback(null, value[i]);
                  }

                  return callback(null, value.get(i));
                }
              }
              // not found
              callback(null, null);
            } catch (ex) {
              callback(ex);
            }
          }
        });
      }

      // enhance arrays with basic find
      if (!value.hasOwnProperty('find')) {
        Object.defineProperty(value, 'find', {
          value: function (query, options, callback) {

            if (callback === undefined) {
              callback = options;
              options = {};
            }

            try {
              var result = [];
              var i;

              for (i = 0; i < value.length; i++) {
                var match = matches(query, value[i]);
                if (match === -1) {
                  return callback('Bad query');
                }
                if (match === -2) {
                  return callback('$in/$nin expect an array');
                }
                if (match === 1) {
                  if (options.directObject) {
                    result.push(value[i]);
                  } else {
                    result.push(value.get(i));
                  }
                }
              }
              callback(null, result);
            } catch (ex) {
              callback(ex);
            }
          }
        });
      }

      // enhance arrays with basic findOne
      if (!value.hasOwnProperty('findOne')) {
        Object.defineProperty(value, 'findOne', {
          value: function (query, options, callback) {

            if (callback === undefined) {
              callback = options;
              options = {};
            }

            try {
              var i;

              for (i = 0; i < value.length; i++) {
                var match = matches(query, value[i]);
                if (match === -1) {
                  return callback('Bad query');
                }
                if (match === -2) {
                  return callback('$in/$nin expect an array');
                }
                if (match === 1) {
                  if (options.directObject) {
                    return callback(null, value[i]);
                  }

                  return callback(null, value.get(i));
                }
              }
              callback(null, null);
            } catch (ex) {
              callback(ex);
            }
          }
        });
      }

      // enhance arrays with basic findOne
      if (!value.hasOwnProperty('findAll')) {
        Object.defineProperty(value, 'findAll', {
          value: function (options, callback) {

            if (callback === undefined) {
              callback = options;
              options = {};
            }

            try {
              var result = [];
              var i;

              for (i = 0; i < value.length; i++) {
                if (options.directObject) {
                  result.push(value[i]);
                } else {
                  result.push(value.get(i));
                }
              }
              callback(null, result);
            } catch (ex) {
              callback(ex);
            }
          }
        });
      }

      // enhance arrays with basic remove
      if (!value.hasOwnProperty('remove')) {
        Object.defineProperty(value, 'remove', {
          value: function (query, callback) {

            try {
              var removed = 0;
              var i;

              for (i = 0; i < value.length; i++) {
                var match = matches(query, value[i]);
                if (match === -1) {
                  return callback('Bad query');
                }
                if (match === -2) {
                  return callback('$in/$nin expect an array');
                }
                if (match === 1) {
                  value.splice(i, 1);
                  i--;
                  removed++;
                }
              }
              callback(null, removed);
            } catch (ex) {
              callback(ex);
            }
          }
        });
      }
    } else {
      // enhance arrays with basic find with equality check
      if (!value.hasOwnProperty('findOne')) {
        Object.defineProperty(value, 'findOne', {
          value: function (val, options, callback) {

            if (callback === undefined) {
              callback = options;
            }

            if (val === undefined) {
              return callback('Undefined Value');
            }

            try {
              var i;

              var hasEquals = val.equals !== undefined && val.equals !== null && typeof(val.equals) === 'function';

              for (i = 0; i < value.length; i++) {
                if (hasEquals) {
                  if (val.equals(value[i])) {
                    return callback(null, value[i]);
                  }
                } else {
                  if (val === value[i]) {
                    return callback(null, value[i]);
                  }
                }
              }
              callback(null, null);
            } catch (ex) {
              callback(ex);
            }
          }
        });
      }

      // enhance arrays with basic remove with equality check
      if (!value.hasOwnProperty('remove')) {
        Object.defineProperty(value, 'remove', {
          value: function (val, callback) {

            if (val === undefined) {
              return callback('Undefined Value');
            }

            try {
              var i;
              var removed = 0;

              var hasEquals = val.equals !== undefined && val.equals !== null && typeof(val.equals) === 'function';

              for (i = 0; i < value.length; i++) {
                if (hasEquals) {
                  if (val.equals(value[i])) {
                    value.splice(i, 1);
                    i--;
                    removed++;
                  }
                } else {
                  if (val === value[i]) {
                    value.splice(i, 1);
                    i--;
                    removed++;
                  }
                }
              }
              callback(null, removed);
            } catch (ex) {
              callback(ex);
            }
          }
        });
      }
    }
  };

  var addSimpleGetterSetter = function (schema, model, key) {
    Object.defineProperty(model, key, {
      get: function () {
        if (model._internalDocument[key] === undefined) {
          if (schema[key].$push) {
            model._internalDocument[key] = [];
          }
        }

        if (schema[key].$push) {
          if (model._internalDocument[key] !== null) {
            odmArray(model._internalDocument[key], schema, model, key);
          }
        }

        return model._internalDocument[key];
      },
      set: function (value) {
        model._internalDocument[key] = schema[key].$set.call(model, value);
      },
      enumerable: true
    });
  };

  var addComplexGetterSetter = function (schema, model, key) {
    Object.defineProperty(model, key, {
      get: function () {

        if (model._internalDocument[key] === undefined) {
          model._internalDocument[key] = {};
        }

        // null is a valid value
        if (model._internalDocument[key] === null) {
          return null;
        }

        var submodel;
        var Type = schema[key].$type;

        if (Type !== undefined && Type.prototype !== undefined && Type.prototype !== null) {
          submodel = Object.create(Type.prototype);
        } else {
          submodel = Object.create(submodelproto);
        }

        // define the internal document
        Object.defineProperty(submodel, '_internalDocument', {value: model._internalDocument[key]});
        // define a read only ref to the parent
        Object.defineProperty(submodel, '$parent', {value: model});
        // build getter
        buildValidator(schema[key], submodel);
        return submodel;
      },
      set: function (value) {
        // undefined (undefined will mean that a value will be deleted from mongo document)
        if (value === undefined) {
          delete model._internalDocument[key];
        } else if (value === null) {
          // null (mongodb and json understand null so allow it)
          model._internalDocument[key] = null;
        } else if (typeof value === 'object') {
          // object (if we pass a object the whole previous object will be replaced)
          model._internalDocument[key] = {};
          // get a reference to the getter
          var submodel = model[key];
          // var sub schema
          var subschema = schema[key];

          var subkey;

          for (subkey in subschema) {
            if (subschema.hasOwnProperty(subkey)) {
              var subvalue = value[subkey];
              if (subvalue !== undefined) {
                submodel[subkey] = value[subkey];
              }
            }
          }
        } else {
          // other cases are not allowed
          throw new Error(key + ' must be an Object');
        }
      },
      enumerable: true
    });
  };

  var key;

  for (key in schema) {
    if (schema.hasOwnProperty(key)) {
      if (schema[key].$set !== undefined) {
        // simple getter/setter
        addSimpleGetterSetter(schema, model, key);
      } else {
        // this is a embedded document
        addComplexGetterSetter(schema, model, key);
      }
    }
  }
}

/**
 * @private
 */
function baseSetter(key, typeName, typeInstance) {
  return function (value) {
    if (value !== undefined && value !== null) {
      if (!((typeof (value) === typeName) || (value instanceof typeInstance))) {
        // TODO: this is wrong we should use the callbacks
        throw new Error(key + ' must be a ' + typeName);
      }
    }
    return value;
  };
}

/**
 * @private
 */
function baseArraySetter(arrayInternalValue, value) {
  // special cases
  if (value === undefined || value === null) {
    return value;
  }

  var obj = {};

  var subKey;
  for (subKey in arrayInternalValue) {
    if (arrayInternalValue.hasOwnProperty(subKey)) {
      var val;
      if (arrayInternalValue[subKey].$set) {
        val = arrayInternalValue[subKey].$set(value[subKey]);
      } else {
        val = baseArraySetter(arrayInternalValue[subKey], value[subKey]);
      }
      if (val !== undefined) {
        obj[subKey] = val;
      }
    }
  }

  return obj;
}

/**
 * @private
 */
function buildInternalSchema(schema) {

  /**
   * @private
   */
  var buildInternalValue = function (key, type) {

    if (type === undefined || type === null) {
      throw new Error('Incomplete schema: ' + key + ' is undefined');
    }

    var internalValue = {
      $set: function (value) {
        return value;
      }
    };

    if (Array.isArray(type)) {
      var arrayInternalValue = buildInternalValue(key, type[0]);

      internalValue.$set = function (value) {
        var retValue;
        if (value) {
          if (Array.isArray(value)) {
            var i;
            retValue = [];
            if (arrayInternalValue.$set !== undefined) {
              // simple types
              for (i = 0; i < value.length; i++) {
                retValue[i] = arrayInternalValue.$set(value[i]);
              }
            } else {
              // embedded doc types
              for (i = 0; i < value.length; i++) {
                retValue[i] = baseArraySetter(arrayInternalValue, value[i]);
              }
            }
          } else {
            // TODO: this is wrong we should use the callbacks
            throw new Error(key + ' must be an Array');
          }
        }
        return retValue;
      };

      // signal this validator is an array and push actions are also validated
      internalValue.$push = function (array, values) {
        var retValue;
        var i;
        var newLength = 0;
        for (i = 0; i < values.length; i++) {
          if (arrayInternalValue.$set !== undefined) {
            // simple type
            retValue = arrayInternalValue.$set(values[i]);
          } else {
            // embedded doc types
            retValue = baseArraySetter(arrayInternalValue, values[i]);
          }
          newLength = Array.prototype.push.call(array, retValue);
        }

        return newLength;
      };

      // if we have embedded models store the type in the top level object
      if (arrayInternalValue.$type !== undefined) {
        internalValue.$type = arrayInternalValue.$type;
      }
    } else if (type === String) {
      internalValue.$set = baseSetter(key, 'string', type);
    } else if (type === Number) {
      internalValue.$set = baseSetter(key, 'number', type);
    } else if (type === Boolean) {
      internalValue.$set = baseSetter(key, 'boolean', type);
    } else if (type === Date) {
      internalValue.$set = baseSetter(key, 'object', type);
    } else if (type === ObjectID) {
      internalValue.$set = function (value) {
        if (value !== undefined && value !== null) {
          // value exists, now it can be either an _id or and object with an _id
          if (value._id !== undefined) {
            if (value._id !== null) {
              if (!(value._id instanceof ObjectID)) {
                // TODO: this is wrong we should use the callbacks
                throw new Error(key + ' must be a ObjectId Object');
              }
            }
            return value._id;
          }

          if (!(value instanceof ObjectID)) {
            // TODO: this is wrong we should use the callbacks
            throw new Error(key + ' must be a ObjectId Object');
          }
        }
        return value;
      };
    } else if (type === Binary) {
      internalValue.$set = baseSetter(key, 'object', type);
    } else if (type === Object) {
      // Object is a special case that allows store anything
      internalValue = {
        $set: function (value) {
          return value;
        }
      };
    } else if (typeof (type) === 'function') {
      if (type.internalSchema !== undefined) {
        internalValue = type.internalSchema;
        Object.defineProperty(internalValue, '$type', {value: type});
      } else {
        throw new Error('type of ' + key + ' is not supported, don\'t know how to implement a schema parser for it');
      }
    } else if (isSpecial(type)) {
      internalValue = {
        $set: (type.$set !== undefined) ? (type.$set) : internalValue.$set
      };
    } else {
      internalValue = buildInternalSchema(type);
    }
    return internalValue;
  };

  var internalSchema = {};
  var key;
  for (key in schema) {
    if (schema.hasOwnProperty(key)) {
      internalSchema[key] = buildInternalValue(key, schema[key]);
    }
  }
  return internalSchema;
}

/**
 * Creates a new Document Model class
 *
 * @memberOf ODM
 * @param {String} [mongoCollection] Collection name, if not present this is an embedded document
 * @param {Boolean} [l2cache] Enable Query Cache (only findAll and findById)
 * @param {Object} schema
 *
 * @return {Model}
 */
module.exports = function (mongoCollection, l2cache, schema) {

  if (schema === undefined) {
    if (l2cache === undefined) {
      schema = mongoCollection;
      l2cache = false;
      mongoCollection = undefined;
    } else {
      schema = l2cache;
      l2cache = false;
    }
  }

  var odm = this;

  var internalSchema = buildInternalSchema(schema);

  var cache = l2cache ? new Cache() : undefined;

  /**
   * @name Model
   * @class Document Model Customized class for a mongodb document schema.
   *
   * @param {Object} [values] initial values to populate an instance of this class
   * @param {Object} [options] used internally to deserialize the values
   */
  var Model = function (values, options) {
    var internalDocument;

    // allow default instantiation
    if (values !== undefined) {
      if (options && options.deserialize) {
        // assume db is consistent, do not drop properties if not defined on the schema
        internalDocument = values;
      } else {
        internalDocument = initialize(internalSchema, values, mongoCollection);
      }
    }

    if (internalDocument === undefined) {
      // allow default instantiation
      internalDocument = {};
    }

    Object.defineProperty(this, '_internalDocument', {value: internalDocument});

    buildValidator(internalSchema, this);

    if (mongoCollection) {
      var self = this;

      Object.defineProperty(self, '_id', {
        get: function () {
          return self._internalDocument._id;
        },
        enumerable: true
      });
    }
  };

  /**
   * Finds one element of this collection by the given query.
   *
   * @memberOf Model
   * @param {Object} query Query object as in mongodb documentation
   * @param {Object} [options] Query options, such as skip, limit, etc
   * @param {Function} callback Callback function (error, model) with the result of the operation
   */
  Model.findOne = function (query, options, callback) {
    if (callback === undefined) {
      callback = options;
      options = {};
    }

    if (!mongoCollection) {
      return callback('Cannot findOne on embedded model');
    }

    odm.collection(mongoCollection, options, function (err, collection) {
      if (err) {
        return callback(err);
      }

      collection.findOne(query, options, function (err, documentLoaded) {
        if (err) {
          return callback(err);
        }

        if (documentLoaded === null) {
          return callback(null, null);
        }

        // special case (return direct document from mongoDB)
        if (options.directObject) {
          return callback(null, documentLoaded);
        }

        try {
          var model = new Model(documentLoaded, { deserialize: true });
          callback(null, model);
        } catch (ex) {
          callback(ex);
        }
      });
    });
  };

  /**
   * Finds one element of this collection given its Id.
   *
   * @memberOf Model
   * @param {ObjectID|String} id Either a ObjectId instance or, the function will try to cast it to ObjectId.
   * @param {Object} [options] Query options, such as skip, limit, etc
   * @param {Function} callback Callback function (error, model) with the result of the operation
   */
  Model.findById = function (id, options, callback) {
    if (callback === undefined) {
      callback = options;
      options = {};
    }

    if (!mongoCollection) {
      return callback('Cannot findById on embedded model');
    }

    if (id === undefined) {
      return callback('undefined id');
    }

    var _id;

    try {
      if (id instanceof ObjectID) {
        _id = id;
      } else {
        _id = new ObjectID(id);
      }
    } catch (ex) {
      return callback(ex);
    }

    // verify if it is in cache
    if (l2cache) {
      var cachedDocument = cache.get(_id.toHexString());

      if (cachedDocument !== undefined) {

        // if we search for an Id and get null return right away
        if (cachedDocument === null) {
          return callback(null, null);
        }

        // special case (return direct document from mongoDB)
        if (options.directObject) {
          return callback(null, cachedDocument);
        }

        try {
          var model = new Model(cachedDocument, { deserialize: true });
          return callback(null, model);
        } catch (exCache) {
          return callback(exCache);
        }
      }
    }

    odm.collection(mongoCollection, options, function (err, collection) {
      if (err) {
        return callback(err);
      }

      collection.findOne({_id: _id}, options, function (err, documentLoaded) {
        if (err) {
          return callback(err);
        }

        if (l2cache) {
          cache.set(_id.toHexString(), documentLoaded);
        }

        // if we search for an Id and get null it should return right away
        if (documentLoaded === null) {
          return callback(null, null);
        }

        // special case (return direct document from mongoDB)
        if (options.directObject) {
          return callback(null, documentLoaded);
        }

        try {
          var model = new Model(documentLoaded, { deserialize: true });
          callback(null, model);
        } catch (ex) {
          if (l2cache) {
            cache.del(_id.toHexString());
          }
          callback(ex);
        }
      });
    });
  };

  /**
   * Free form find in collection. The result is returned as a Array of this model objects.
   *
   * @memberOf Model
   * @param {Object} query MongoDB Query
   * @param {Object} [fields] filter the fields to be returned
   * @param {Object} [options] options for the query
   *        options.directObject returns the object directly from mongodb without any ODM decoration
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
          // special case (return direct document from mongoDB)
          if (options.directObject) {
            return callback(null, documentsLoaded);
          }

          try {
            var i;
            for (i = 0; i < documentsLoaded.length; i++) {
              documentsLoaded[i] = new Model(documentsLoaded[i], { deserialize: true });
            }
            callback(null, documentsLoaded);
          } catch (ex) {
            callback(ex);
          }
        });
      });
    });
  };

  /**
   * Finds all elements in this collection.
   *
   * @memberOf Model
   * @param {Object} [fields] filter the fields to be returned
   * @param {Object} [options] options for the query
   * @param {Function} callback Callback function (error, model) with the result of the operation
   */
  Model.findAll = function (fields, options, callback) {
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
      return callback('Cannot findAll on embedded model');
    }

    // verify if it is in cache
    if (l2cache) {
      var cachedDocuments = cache.get('all');

      if (cachedDocuments !== undefined) {

        // special case (return direct document from mongoDB)
        if (options.directObject) {
          return callback(null, cachedDocuments);
        }

        try {
          var documentsLoaded = [];
          var i;
          for (i = 0; i < cachedDocuments.length; i++) {
            documentsLoaded[i] = new Model(cachedDocuments[i], { deserialize: true });
          }
          return callback(null, documentsLoaded);
        } catch (ex) {
          return callback(ex);
        }
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
            cache.set('all', documentsLoaded);
          }

          // special case (return direct document from mongoDB)
          if (options.directObject) {
            return callback(null, documentsLoaded);
          }

          try {
            // do not reuse the variable documentsLoaded since it will mess with the cache
            var returnDocuments = [];
            var i;
            for (i = 0; i < documentsLoaded.length; i++) {
              returnDocuments[i] = new Model(documentsLoaded[i], { deserialize: true });
            }
            callback(null, returnDocuments);
          } catch (ex) {
            if (l2cache) {
              cache.del('all');
            }
            callback(ex);
          }
        });
      });
    });
  };

  /**
   * Loads documents referenced by id/ids. This is a helper function that calls internally find or findById
   * with the correct parameters.
   *
   * @memberOf Model
   * @param {ObjectID|ObjectID[]} ids single or array of ObjectId objects
   * @param {Object} [fields] filter the fields to be returned
   * @param {Object} [options] options for the query
   * @param {Function} callback Callback function (error, model) with the result of the operation
   */
  Model.loadDbRef = function (ids, fields, options, callback) {
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
      return callback('Cannot loadDbRef on embedded model');
    }

    if (Array.isArray(ids)) {
      if (ids.length === 0) {
        callback(null, []);
      } else {
        // convert the orig array to an index
        var index = {};
        var i;

        for (i = 0; i < ids.length; i++) {
          if (! ids[i] instanceof ObjectID) {
            return callback('Non ObjectId in the array');
          }

          if (index[ids[i].toHexString()] === undefined) {
            index[ids[i].toHexString()] = [i];
          } else {
            index[ids[i].toHexString()].push(i);
          }
        }

        this.find({_id: {'$in': ids}}, fields, options, function (err, models) {
          if (err) {
            return callback(err);
          }

          var result = [];
          var i, j;

          // using the index we have O(2n) complexity
          for (i = 0; i < models.length; i++) {
            var indexes = index[models[i]._id.toHexString()];
            for (j = 0; j < indexes.length; j++) {
              result[indexes[j]] = models[i];
            }
          }

          callback(null, result);
        });
      }
    } else {
      this.findById(ids, options, callback);
    }
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

    odm.collection(mongoCollection, options, function (err, collection) {
      if (err) {
        return callback(err);
      }

      collection.ensureIndex(fieldOrSpec, options, callback);
    });
  };

  /**
   * Convert a object instance to a JSON object.
   *
   * @memberOf Model
   */
  Model.prototype.toJSON = function () {
    return this._internalDocument;
  };

  /**
   * Convert a object instance to a String object.
   *
   * @memberOf Model
   */
  Model.prototype.toString = function () {
    return JSON.stringify(this._internalDocument);
  };

  /**
   * Mimic Object.hasOwnProperty
   *
   * @param propertyName
   * @return {Boolean}
   */
  Model.prototype.hasOwnProperty = function (propertyName) {
    return hasOwnPropertyProto(this._internalDocument, propertyName);
  };

  /**
   * Return true if there are NO properties defined in this Object
   * @return {Boolean}
   */
  Model.prototype.isEmpty = function () {
    return isEmptyProto(this._internalDocument);
  };

  /**
   * Save this object instance to the backend mongodb instance.
   *
   * @memberOf Model
   * @param {Object} [options] options for the query
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

    odm.collection(mongoCollection, options, function (err, collection) {
      if (err) {
        return callback(err);
      }

      collection.save(self._internalDocument, options, function (err, savedDocument) {
        if (err) {
          return callback(err);
        }
        // only inserts have savedDocument
        if (savedDocument) {
          self._internalDocument._id = savedDocument._id;
        }
        // document updated delete from cache since it is not valid anymore
        if (l2cache) {
          cache.del(self._internalDocument._id.toHexString());
        }
        callback(null, self._internalDocument._id);
      });
    });
  };

  /**
   * Remove this object instance from the backend mongodb instance.
   *
   * @memberOf Model
   * @param {Object} [options] options for the query
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

    odm.collection(mongoCollection, {}, function (err, collection) {
      if (err) {
        return callback(err);
      }

      collection.remove({ _id: self._id }, options, function (err) {
        // document deleted, delete from cache since it is not valid anymore
        if (l2cache) {
          cache.del(self._id.toHexString());
        }
        callback(err);
      });
    });
  };

  /**
   * Remove this object instance from the backend mongodb instance.
   *
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

    if (!mongoCollection) {
      return callback('Cannot remove on embedded model');
    }

    odm.collection(mongoCollection, {}, function (err, collection) {
      if (err) {
        return callback(err);
      }

      collection.remove(query, options, callback);
    });
  };

  /**
   * schema for embedded objects
   *
   * @memberOf Model
   */
  Object.defineProperty(Model, 'internalSchema', {value: internalSchema});

  // create a ref object (this is just an alias for ObjectID if we define a collection name)
  if (mongoCollection) {
    Object.defineProperty(Model, 'Ref', {value: ObjectID});
  }

  return Model;
};
