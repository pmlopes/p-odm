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

var objectIdRegExp = new RegExp("^[0-9a-fA-F]{24}$");

/**
 * @private
 */
function clone(obj) {

  var newObj = Array.isArray(obj) ? [] : {};
  var i;
  for (i in obj) {
    if (obj.hasOwnProperty(i)) {
      var v = obj[i];
      if (v === undefined) {
        continue;
      }

      if (v === null || v instanceof String || v instanceof Number || v instanceof Boolean || v instanceof Date || v instanceof ObjectID || v instanceof Binary) {
        newObj[i] = obj[i];
      } else if (typeof obj[i] === 'object') {
        newObj[i] = clone(obj[i]);
      } else {
        newObj[i] = obj[i];
      }
    }
  }

  return newObj;
}

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

/**
 * Extracts one option from the object and returns it.
 * @private
 */
function hasOption(name, options) {
  var option;
  if (options) {
    if (options.hasOwnProperty(name)) {
      option = options[name];
    }
  }
  return option;
}

/**
 * @private
 * Initialize the model object with the data either from db or from user
 */
function initialize(schema, dbdata, collectionName) {
  var data, value, key;

  if (typeof dbdata === 'object') {
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
  } else {
    console.error('\'' + dbdata + '\' expected to be an object in the model [' + collectionName + ']');
  }

  return data;
}

// common instance prototype helpers
function isEmptyProto(obj) {
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

function hasOwnPropertyProto(obj, key) {
  if (obj === undefined || obj === null) {
    return true;
  }

  return obj.hasOwnProperty(key);
}

var submodelproto = {
  toJSON: function () {
    return clone(compactObject(this._internalDocument));
  },
  toString: function () {
    return JSON.stringify(compactObject(this._internalDocument));
  },
  hasOwnProperty: function (key) {
    return hasOwnPropertyProto(this._internalDocument, key);
  },
  isEmpty: function () {
    return isEmptyProto(this._internalDocument);
  }
};

function matchValue(search, value, reverse) {
  var hasEquals = search.equals !== undefined && search.equals !== null && typeof search.equals === 'function';

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
          if (matchValue(search[j], obj[key], false)) {
            matched = true;
            break;
          }
        }
        if (negate) {
          if (matched) {
            return 0;
          }
        } else {
          if (!matched) {
            return 0;
          }
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
 * Verify if the object matches the query
 * @param query
 * @param value
 */
function matchesSimple(query, value) {

  var search = query;
  var i;

  if (search === undefined || search === null) {
    return -1;
  }

  var negate = false;

  if (query.hasOwnProperty('$ne')) {
    negate = true;
    search = query.$ne;

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

  if (multi) {
    var matched = false;
    for (i = 0; i < search.length; i++) {
      if (matchValue(search[i], value, false)) {
        matched = true;
        break;
      }
    }
    if (negate) {
      if (matched) {
        return 0;
      }
    } else {
      if (!matched) {
        return 0;
      }
    }
  } else {
    if (!matchValue(search, value, negate)) {
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
              var embeddedModel = model['_' + key];

              if (embeddedModel === undefined) {
                if (Type.prototype !== undefined && Type.prototype !== null) {
                  embeddedModel = Object.create(Type.prototype);
                } else {
                  embeddedModel = Object.create(submodelproto);
                }
                // define a read only ref to the parent
                Object.defineProperty(embeddedModel, '$parent', {value: model});
                // build the getter/setter
                buildValidator(Type.internalSchema, embeddedModel);
                // save the computed object
                Object.defineProperty(model, '_' + key, {value: embeddedModel});
              }

              // define the internal document
              Object.defineProperty(embeddedModel, '_internalDocument', {value: model._internalDocument[key][index], configurable: true});
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

            var directObject = extractOption('directObject', options);
            var includeNotFound = extractOption('includeNotFound', options);

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

            var i;

            for (i = 0; i < value.length; i++) {
              var el = value[i];
              if (el.hasOwnProperty('_id') && _id.equals(el._id)) {
                if (directObject) {
                  return callback(null, value[i]);
                }

                return callback(null, value.get(i));
              }
            }
            // not found
            if (includeNotFound) {
              return callback(null, null);
            } else {
              return callback(_id.toHexString() + ' not found');
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

            var result = [];
            var i;

            var directObject = extractOption('directObject', options);

            for (i = 0; i < value.length; i++) {
              var match = matches(query, value[i]);
              if (match === -1) {
                return callback('Bad query');
              }
              if (match === -2) {
                return callback('$in/$nin expect an array');
              }
              if (match === 1) {
                if (directObject) {
                  result.push(value[i]);
                } else {
                  result.push(value.get(i));
                }
              }
            }
            callback(null, result);
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

            var i;
            var directObject = extractOption('directObject', options);

            for (i = 0; i < value.length; i++) {
              var match = matches(query, value[i]);
              if (match === -1) {
                return callback('Bad query');
              }
              if (match === -2) {
                return callback('$in/$nin expect an array');
              }
              if (match === 1) {
                if (directObject) {
                  return callback(null, value[i]);
                }

                return callback(null, value.get(i));
              }
            }
            callback(null, null);
          }
        });
      }

      // enhance arrays with basic findAll
      if (!value.hasOwnProperty('findAll')) {
        Object.defineProperty(value, 'findAll', {
          value: function (options, callback) {

            if (callback === undefined) {
              callback = options;
              options = {};
            }

            var result = [];
            var i;
            var directObject = extractOption('directObject', options);

            for (i = 0; i < value.length; i++) {
              if (directObject) {
                result.push(value[i]);
              } else {
                result.push(value.get(i));
              }
            }
            callback(null, result);
          }
        });
      }

      // enhance arrays with basic remove
      if (!value.hasOwnProperty('remove')) {
        Object.defineProperty(value, 'remove', {
          value: function (query, callback) {

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
          }
        });
      }
    } else {
      // enhance arrays with basic findOne with equality check
      if (!value.hasOwnProperty('findOne')) {
        Object.defineProperty(value, 'findOne', {
          value: function (val, options, callback) {

            if (callback === undefined) {
              callback = options;
            }

            if (val === undefined) {
              return callback('Undefined Value');
            }

            var i;

            for (i = 0; i < value.length; i++) {
              var match = matchesSimple(val, value[i]);
              if (match === -1) {
                return callback('Bad query');
              }
              if (match === -2) {
                return callback('$in/$nin expect an array');
              }
              if (match === 1) {
                return callback(null, value[i]);
              }
            }
            callback(null, null);
          }
        });
      }

      // enhance arrays with basic find with equality check
      if (!value.hasOwnProperty('find')) {
        Object.defineProperty(value, 'find', {
          value: function (val, options, callback) {

            if (callback === undefined) {
              callback = options;
              // options = {};
            }

            var result = [];
            var i;

            for (i = 0; i < value.length; i++) {
              var match = matchesSimple(val, value[i]);
              if (match === -1) {
                return callback('Bad query');
              }
              if (match === -2) {
                return callback('$in/$nin expect an array');
              }
              if (match === 1) {
                result.push(value[i]);
              }
            }
            callback(null, result);
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

            var i;
            var removed = 0;

            for (i = 0; i < value.length; i++) {
              var match = matchesSimple(val, value[i]);
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
          }
        });
      }
    }
  };

  var addSimpleGetterSetter = function (schema, model, key) {
    Object.defineProperty(model, key, {
      get: function () {
        if (this._internalDocument[key] === undefined) {
          if (schema[key].$push) {
            this._internalDocument[key] = [];
          }
        }

        if (schema[key].$push) {
          if (this._internalDocument[key] !== null) {
            odmArray(this._internalDocument[key], schema, this, key);
          }
        }

        return this._internalDocument[key];
      },
      set: function (value) {
        this._internalDocument[key] = schema[key].$set.call(this, value);
      },
      enumerable: true
    });
  };

  var addComplexGetterSetter = function (schema, model, key) {
    Object.defineProperty(model, key, {
      get: function () {
        // null is a valid value
        if (this._internalDocument[key] === null) {
          return null;
        }

        var submodel = model['_' + key];
        if (submodel === undefined) {
          var Type = schema[key].$type;

          if (Type !== undefined && Type.prototype !== undefined && Type.prototype !== null) {
            submodel = Object.create(Type.prototype);
          } else {
            submodel = Object.create(submodelproto);
          }
          // define a read only ref to the parent
          Object.defineProperty(submodel, '$parent', {value: this});
          // build getter
          buildValidator(schema[key], submodel);
          // save the computed object
          Object.defineProperty(model, '_' + key, {value: submodel});
        }

        if (this._internalDocument[key] === undefined) {
          this._internalDocument[key] = {};
        }

        // define the internal document
        Object.defineProperty(submodel, '_internalDocument', {value: this._internalDocument[key], configurable: true});
        return submodel;
      },
      set: function (value) {
        // undefined (undefined will mean that a value will be deleted from mongo document)
        if (value === undefined) {
          delete this._internalDocument[key];
        } else if (value === null) {
          // null (mongodb and json understand null so allow it)
          this._internalDocument[key] = null;
        } else if (typeof value === 'object') {
          // object (if we pass a object the whole previous object will be replaced)
          this._internalDocument[key] = {};
          // get a reference to the getter
          var submodel = this[key];
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
          // TODO: this is wrong we should use the callbacks
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
          if (value instanceof ObjectID) {
            return value;
          }

          // if string try to convert
          if (typeof value  === 'string' && value.length === 24 && objectIdRegExp.test(value)) {
            return ObjectID.createFromHexString(value);
          }

          // value exists, now it can be either an _id or and object with an _id
          if (value.hasOwnProperty('_id')) {
            if (value._id !== undefined) {
              if (value._id === null) {
                return null;
              }

              if (value._id instanceof ObjectID) {
                return value._id;
              }
            }
          }

          // TODO: this is wrong we should use the callbacks
          throw new Error(key + ' must be a ObjectId Object');
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
      if (type.internalSchema === undefined) {
        internalValue = buildInternalSchema(type);
        type.internalSchema = internalValue;
        Object.defineProperty(internalValue, '$type', {value: type});
      }
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
 * Compacts the given object (removes empty objects).
 *
 * @param {Object} obj Object to compact
 * @return {Object} the updated object, the top level object is modified, the return is just a helper
 */
function compactObject(obj) {
  if (obj === undefined || obj === null || obj instanceof String || obj instanceof Number || obj instanceof Boolean || obj instanceof Date || obj instanceof ObjectID || obj instanceof Binary) {
    return obj;
  }

  if (!Array.isArray(obj) && typeof obj === 'object') {
    var key;
    for (key in obj) {
      if (obj.hasOwnProperty(key)) {
        var v = obj[key];

        // handle undefined
        if (v === undefined) {
          delete obj[key];
          continue;
        }

        // special cases (skip)
        if (v === null || v instanceof String || v instanceof Number || v instanceof Boolean || v instanceof Date || v instanceof ObjectID || v instanceof Binary) {
          continue;
        }

        // handle objects
        if (!Array.isArray(v) && typeof v === 'object') {
          if (isEmptyProto(v)) {
            delete obj[key];
          } else {
            // recurse
            compactObject(v);
            // need to recheck since the object might have been updated
            if (isEmptyProto(v)) {
              delete obj[key];
            }
          }
        }
      }
    }
  }

  return obj;
}

/**
 * Helper caching function
 *
 * @param {Object} cache The Cache Manager Objects
 * @param {String} field field used to index the cache
 * @param {String} value the value for the index key
 * @param {Boolean} isModel is this a js object or model
 * @return {Object}
 */
function isCached(cache, field, value, isModel) {
  if (cache !== undefined) {
    return cache.get(field + ':' + value + (isModel ? ':model' : ''));
  }
  return undefined;
}

/**
 * Helper caching function
 *
 * @param {Object} cache The Cache Manager Objects
 * @param {String} field field used to index the cache
 * @param {String} value the value for the index key
 * @param {Boolean} isModel is this a js object or model
 * @param {Object} doc Document to store
 */
function putToCache(cache, field, value, isModel, doc) {
  if (cache !== undefined) {
    cache.set(field + ':' + value + (isModel ? ':model' : ''), doc);
  }
}

/**
 * Clears a cache entry for a specific model
 * @param {Object} cache The Cache Manager Objects
 * @param {String[]} indexes for the model
 * @param {Model} model Model that triggered the cleanup
 */
function purgeCache(cache, indexes, model) {
  if (cache !== undefined) {
    var _id = model._id;
    if (_id !== undefined && _id !== null) {
      if (_id instanceof ObjectID) {
        cache.del('_id:' + _id.toHexString());
        cache.del('_id:' + _id.toHexString() + ':model');
      }
    }
    if (indexes !== undefined && indexes !== null) {
      var i;
      for (i = 0; i < indexes.length; i++) {
        cache.del(indexes[i] + ':' + model[indexes[i]]);
        cache.del(indexes[i] + ':' + model[indexes[i]] + ':model');
      }
    }
    cache.del('::all');
    cache.del('::all:model');
  }
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

  var cache = l2cache ? new Cache({cacheSize: 1024, ttl: 300000}) : undefined;

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

    Object.defineProperty(this, '_internalDocument', {
      configurable: true,
      value: internalDocument
    });

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

    var directObject = extractOption('directObject', options);

    odm.findOne(mongoCollection, query, fields, options, function (err, documentLoaded) {
      if (err) {
        return callback(err);
      }

      if (documentLoaded === null) {
        return callback(null, null);
      }

      // special case (return direct document from mongoDB)
      if (directObject) {
        return callback(null, documentLoaded);
      }

      var model = new Model(documentLoaded, { deserialize: true });
      callback(null, model);
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
    var directObject = extractOption('directObject', options);
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

    var cachedDocument = isCached(cache, '_id', _id.toHexString(), directObject);

    if (cachedDocument !== undefined) {
      // if we search for an Id and get null return right away
      if (cachedDocument === null) {
        if (includeNotFound) {
          return callback(null, null);
        } else {
          return callback(mongoCollection + ' ' + _id.toHexString() + ' not found');
        }
      }
      return callback(null, cachedDocument);
    }

    odm.findOne(mongoCollection, {_id: _id}, fields, options, function (err, documentLoaded) {
      if (err) {
        return callback(err);
      }

      // if we search for an Id and get null it should return right away
      if (documentLoaded === null) {
        putToCache(cache, '_id', _id.toHexString(), directObject, null);

        if (includeNotFound) {
          return callback(null, null);
        } else {
          return callback(mongoCollection + ' ' + _id.toHexString() + ' not found');
        }
      }

      // special case (return direct document from mongoDB)
      if (directObject) {
        putToCache(cache, '_id', _id.toHexString(), directObject, documentLoaded);
        return callback(null, documentLoaded);
      }

      var model = new Model(documentLoaded, { deserialize: true });
      putToCache(cache, '_id', _id.toHexString(), directObject, model);
      callback(null, model);
    });
  };

  /**
   * Free form find in collection. The result is returned as a Array of this model objects.
   *
   * @memberOf Model
   * @param {Object} query MongoDB Query
   * @param {Object|Function} [fields] filter the fields to be returned
   * @param {Object|Function} [options] options for the query
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

    var directObject = extractOption('directObject', options);

    var pluck = extractOption('pluck', options);

    if (pluck !== undefined) {
      directObject = true;
      // state that we only care about the plucked field
      fields[pluck] = true;
    }

    odm.find(mongoCollection, query, fields, options, function (err, documentsLoaded) {
      if (err) {
        return callback(err);
      }
      var i;
      // special case (return direct document from mongoDB)
      if (directObject) {
        if (pluck !== undefined) {
          for (i = 0; i < documentsLoaded.length; i++) {
            documentsLoaded[i] = documentsLoaded[i][pluck];
          }
          return callback(null, documentsLoaded);
        } else {
          return callback(null, documentsLoaded);
        }
      }

      for (i = 0; i < documentsLoaded.length; i++) {
        documentsLoaded[i] = new Model(documentsLoaded[i], { deserialize: true });
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

    var directObject = extractOption('directObject', options);

    var pluck = extractOption('pluck', options);

    if (pluck !== undefined) {
      directObject = true;
      // state that we only care about the plucked field
      fields[pluck] = true;
    }

    var cachedDocuments = isCached(cache, '', 'all', directObject);

    if (cachedDocuments !== undefined) {

      var documentsLoaded = [];
      var i;

      // special case (return direct document from mongoDB)
      if (directObject) {
        if (pluck !== undefined) {
          for (i = 0; i < cachedDocuments.length; i++) {
            documentsLoaded[i] = cachedDocuments[i][pluck];
          }
          return callback(null, documentsLoaded);
        }
      }

      return callback(null, cachedDocuments);
    }

    odm.find(mongoCollection, {}, fields, options, function (err, documentsLoaded) {
      if (err) {
        return callback(err);
      }

      // special case (return direct document from mongoDB)
      if (directObject) {
        if (pluck !== undefined) {
          for (i = 0; i < documentsLoaded.length; i++) {
            documentsLoaded[i] = documentsLoaded[i][pluck];
          }
          return callback(null, documentsLoaded);
        } else {
          putToCache(cache, '', 'all', directObject, documentsLoaded);
          return callback(null, documentsLoaded);
        }
      }

      // do not reuse the variable documentsLoaded since it will mess with the cache
      var returnDocuments = [];
      var i;
      for (i = 0; i < documentsLoaded.length; i++) {
        returnDocuments[i] = new Model(documentsLoaded[i], { deserialize: true });
      }
      putToCache(cache, '', 'all', directObject, returnDocuments);
      callback(null, returnDocuments);
    });
  };

  /**
   * Loads documents referenced by id/ids. This is a helper function that calls internally find or findById
   * with the correct parameters.
   *
   * @memberOf Model
   * @param {ObjectID|ObjectID[]} ids single or array of ObjectId objects
   * @param {Object|Function} [fields] filter the fields to be returned
   * @param {Object|Function} [options] options for the query
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
        var idsToFind = [];
        var result = [];

        var directObject = hasOption('directObject', options);

        for (i = 0; i < ids.length; i++) {
          if (!(ids[i] instanceof ObjectID)) {
            return callback('Non ObjectId in the array');
          }

          var cachedDoc = isCached(cache, '_id', ids[i].toHexString(), directObject);
          if (cachedDoc !== undefined) {
            result[i] = cachedDoc;
          } else {
            idsToFind.push(ids[i]);
            // build index for the missing data
            if (index[ids[i].toHexString()] === undefined) {
              index[ids[i].toHexString()] = [i];
            } else {
              index[ids[i].toHexString()].push(i);
            }
          }
        }

        // all items were already cached
        if (idsToFind.length === 0) {
          return callback(null, result);
        }

        Model.find({_id: {'$in': idsToFind}}, fields, options, function (err, models) {
          if (err) {
            return callback(err);
          }

          var i, j;

          // using the index we have O(2n) complexity
          for (i = 0; i < models.length; i++) {
            putToCache(cache, '_id', models[i]._id.toHexString(), directObject, models[i]);

            var indexes = index[models[i]._id.toHexString()];
            for (j = 0; j < indexes.length; j++) {
              result[indexes[j]] = models[i];
            }
          }

          callback(null, result);
        });
      }
    } else {
      Model.findById(ids, options, callback);
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

    var indexFields = Object.keys(fieldOrSpec);

    if (indexFields.length === 1) {
      var field = indexFields[0];
      // only create special finder if the index is not on a sub document
      if (field.indexOf('.') === -1) {
        // create special find with cache method
        var methodName = 'findBy' + field.substr(0, 1).toUpperCase() + field.substr(1);
        var valid = Model.internalSchema[field].$set;

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
          var _idString;
          var directObject = extractOption('directObject', options);

          try {
            _id = valid(id);
            if (_id instanceof ObjectID) {
              _idString = _id.toHexString();
            } else {
              _idString = _id.toString();
            }
          } catch (ex) {
            return callback(ex);
          }

          var cachedDocument = isCached(cache, field, _idString, directObject);

          if (cachedDocument !== undefined) {

            // if we search for an Id and get null return right away
            if (cachedDocument === null) {
              if (includeNotFound) {
                return callback(null, null);
              } else {
                return callback(mongoCollection + ' ' + _id + ' not found');
              }
            }
            return callback(null, cachedDocument);
          }

          var query = {};
          query[field] = _id;

          odm.findOne(mongoCollection, query, fields, options, function (err, documentLoaded) {
            if (err) {
              return callback(err);
            }

            // if we search for an Id and get null it should return right away
            if (documentLoaded === null) {
              putToCache(cache, field, _idString, directObject, null);
              if (includeNotFound) {
                return callback(null, null);
              } else {
                return callback(mongoCollection + ' ' + _id + ' not found');
              }
            }

            // special case (return direct document from mongoDB)
            if (directObject) {
              putToCache(cache, field, _idString, directObject, documentLoaded);
              return callback(null, documentLoaded);
            }

            var model = new Model(documentLoaded, { deserialize: true });
            putToCache(cache, field, _idString, directObject, model);
            callback(null, model);
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

  /**
   * Convert a object instance to a JSON object.
   *
   * @memberOf Model
   */
  Model.prototype.toJSON = function () {
    return clone(compactObject(this._internalDocument));
  };

  /**
   * Convert a object instance to a String object.
   *
   * @memberOf Model
   */
  Model.prototype.toString = function () {
    return JSON.stringify(compactObject(this._internalDocument));
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

    odm.save(mongoCollection, compactObject(self._internalDocument), options, function (err, savedDocument) {
      if (err) {
        return callback(err);
      }
      // only inserts have savedDocument
      if (savedDocument) {
        self._internalDocument._id = savedDocument._id;
      }
      // document updated delete from cache since it is not valid anymore
      purgeCache(cache, Model.IndexKeys, self);
      callback(null, self._internalDocument._id);
    });
  };

  /**
   * Update this object instance to the backend mongodb instance.
   *
   * @memberOf Model
   * @param {Object|Function} [options] options for the query
   * @param {Function} callback Callback function (error, documentId) with the result of the operation
   */
  Model.prototype.update = function (document, options, callback) {
    if (callback === undefined) {
      callback = options;
      options = {};
    }

    if (!mongoCollection) {
      return callback('Cannot save on embedded model');
    }

    var self = this;

    odm.update(mongoCollection, {_id: self._internalDocument._id}, document, options, function (err, modifiedCount) {
      if (err) {
        return callback(err);
      }
      // document updated delete from cache since it is not valid anymore
      purgeCache(cache, Model.IndexKeys, self);
      callback(null, modifiedCount);
    });
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

    odm.remove(mongoCollection, {_id: self._id}, options, function (err) {
      // document deleted, delete from cache since it is not valid anymore
      purgeCache(cache, Model.IndexKeys, self);
      callback(err);
    });
  };

  /**
   * Reloads this object from the underlying mongo DB.
   *
   * @memberOf Model
   * @param {Function} callback Callback function (error) with the result of the operation
   */
  Model.prototype.reload = function (callback) {
    if (!mongoCollection) {
      return callback('Cannot remove on embedded model');
    }

    var self = this;
    var _id = self._internalDocument._id;

    if (!(_id instanceof ObjectID)) {
      return callback('cannot reload a non stored model');
    }

    odm.findOne(mongoCollection, {_id: _id}, {}, {}, function (err, documentLoaded) {
      if (err) {
        return callback(err);
      }

      // if we search for an Id and get null it should return right away with error
      if (documentLoaded === null) {
        return callback('id not found');
      }

      Object.defineProperty(self, '_internalDocument', {
        configurable: true,
        value: documentLoaded
      });

      putToCache(cache, '_id', _id.toHexString(), true, self);
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
   * schema for embedded objects
   *
   * @memberOf Model
   */
  Object.defineProperty(Model, 'internalSchema', {value: internalSchema});

  // create a ref object (this is just an alias for ObjectID if we define a collection name)
  if (mongoCollection) {
    Object.defineProperty(Model, 'Ref', {value: ObjectID});
    Object.defineProperty(Model, 'IndexKeys', {value: []});
  }

  return Model;
};
