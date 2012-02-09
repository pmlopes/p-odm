'use strict';

/**
 * @fileOverview This file has functions related to Object Document Mapping between JavaScript and MongoDB.
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
function _isSpecial(obj) {
  for (var key in obj) {
    if (obj.hasOwnProperty(key) && key.charAt(0) == '$') return true;
  }
  return false;
}

/**
 * @private
 * Initialize the model object with the data either from db or from user
 */
function __initialize(schema, dbdata, loadOrSet) {
  var data, value;

  for (var key in schema) {
    if (schema.hasOwnProperty(key)) {
      // reset
      value = undefined;

      if(schema[key][loadOrSet] !== undefined) {
        // this is a leaf (contains data)
        if(dbdata !== undefined && dbdata !== null) {
          value = schema[key][loadOrSet](dbdata[key]);
        }
      } else {
        // this is a branch (embedded document)
        value = __initialize(schema[key], dbdata[key], loadOrSet);
      }

      // load or set if the db document contains the key
      if(value !== undefined) {
        if(data === undefined) data = {};
        data[key] = value;
      }

    }
  }

  return data;
}

/**
 * @private
 * @param schema document schema
 * @param model model of this document
 */
function __buildValidator(schema, model) {
  for(var key in schema) {
    if(schema.hasOwnProperty(key)) {
      if(schema[key].$get !== undefined && schema[key].$load !== undefined && schema[key].$set !== undefined) {
        // simple getter/setter
        var addSimpleGetterSetter = function(schema, model, key) {
          Object.defineProperty(model, key, {
            get: function() {
              if(model._internalDocument[key] !== undefined) {
                var value = schema[key].$get.call(model, model._internalDocument[key]);

                if(schema[key].$push) {
                  value.push = function() {
                    schema[key].$push.call(model, model._internalDocument[key], arguments);
                  };
                }
                return value;
              }
            },
            set: function(value) {
              model._internalDocument[key] = schema[key].$set.call(model, value);
            },
            enumerable: true
          });
        };
        addSimpleGetterSetter(schema, model, key);
      } else {
        // this is a embedded document
        var addComplexGetterSetter = function(schema, model, key) {

          var cachedSubmodel;

          Object.defineProperty(model, key, {
            get: function() {
              if(model._internalDocument[key] !== undefined) {
                // define the internal document
                if(cachedSubmodel === undefined) {
                  cachedSubmodel = {
                    toJSON: function() {
                      return this._internalDocument;
                    },
                    toString: function() {
                      return JSON.stringify(this._internalDocument);
                    }
                  };
                  Object.defineProperty(cachedSubmodel, '_internalDocument', {value: model._internalDocument[key]});
                  // build getter
                  __buildValidator(schema[key], cachedSubmodel);
                }
                // TODO: enhance the object with the model methods
                return cachedSubmodel;
              }
            },
            set: function(value) {
              // undefined (undefined will mean that a value will be deleted from mongo document)
              if(value === undefined) {
                delete model._internalDocument[key];
                // delete the cached submodel
                cachedSubmodel = undefined;
              } else
              // null (mongodb and json understand null so allow it)
              if(value === null) {
                model._internalDocument[key] = null;
              } else
              // object (if we pass a object the whole previous object will be replaced)
              if(typeof value === 'object')
              {
                model._internalDocument[key] = {};
                // get a reference to the getter
                var submodel = model[key];
                // var sub schema
                var subschema = schema[key];

                for(var subkey in subschema) {
                  if(subschema.hasOwnProperty(subkey)) {
                    var subvalue = value[subkey];
                    if(subvalue !== undefined) {

                      submodel[subkey] = value[subkey];
                    }
                  }
                }
              }
              // other cases are not allowed
              else {
                throw new Error(key + ' must be an Object');
              }
            },
            enumerable: true
          });
        };
        addComplexGetterSetter(schema, model, key);
      }
    }
  }
}

/**
 * @private
 */
function _baseSetter(key, typeName, typeInstance) {
  return function (value) {
    if(value) {
      if (!((typeof(value) == typeName) || (value instanceof typeInstance))) {
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
function _baseArrayLoadOrSetter(arrayInternalValue, loadOrSet, value) {
  var obj;
  if(value) {
    obj = {};
    for (var subKey in arrayInternalValue) {
      if (arrayInternalValue.hasOwnProperty(subKey)) {
        var val;
        if(arrayInternalValue[subKey][loadOrSet]) {
          val = arrayInternalValue[subKey][loadOrSet](value[subKey]);
        } else {
          val = _baseArrayLoadOrSetter(arrayInternalValue[subKey], loadOrSet, value[subKey]);
        }
        if (val !== undefined) {
          obj[subKey] = val;
        }
      }
    }
  }
  return obj;
}

/**
 * @private
 */
function __buildInternalValue(key, type) {

  if(type === undefined) {
    // TODO: this is wrong we should use the callbacks
    throw new Error('Incomplete schema: ' + key + ' is undefined');
  }

  var internalValue = {
    $get:function (value) {
      return value;
    },
    $set:function (value) {
      return value;
    },
    $load:function (value) {
      return value;
    }
  };

  if (Array.isArray(type)) {
    var arrayInternalValue = __buildInternalValue(key, type[0]);

    internalValue.$set = function (value) {
      var retValue;
      if (value) {
        if(Array.isArray(value)) {
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
              retValue[i] = _baseArrayLoadOrSetter(arrayInternalValue, '$set', value[i]);
            }
          }
        } else {
          // TODO: this is wrong we should use the callbacks
          throw new Error(key + ' must be an Array');
        }
      }
      return retValue;
    };

    internalValue.$load = function (value) {
      var retValue;
      if (value) {
        var i;
        retValue = [];
        if (arrayInternalValue.$load !== undefined) {
          // simple types
          for (i = 0; i < value.length; i++) {
            retValue[i] = arrayInternalValue.$load(value[i]);
          }
        } else {
          // embedded doc types
          for (i = 0; i < value.length; i++) {
            retValue[i] = _baseArrayLoadOrSetter(arrayInternalValue, '$load', value[i]);
          }
        }
      }
      return retValue;
    };
    // signal this validator is an array and push actions are also validated
    internalValue.$push = function (array, values) {
      var retValue;
      for(var i=0; i<values.length; i++) {
        if (arrayInternalValue.$set !== undefined) {
          // simple type
          retValue = arrayInternalValue.$set(values[i]);
        } else {
          // embedded doc types
          retValue = _baseArrayLoadOrSetter(arrayInternalValue, '$set', values[i]);
        }
        Array.prototype.push.call(array, retValue);
      }
    };
  } else if (type === String) {
    internalValue.$set = _baseSetter(key, 'string', String);
    internalValue.$load = function (value) {
      if(value !== undefined) {
        return String(value).valueOf();
      }
    };
  } else if (type === Number) {
    internalValue.$set = _baseSetter(key, 'number', Number);
    internalValue.$load = function (value) {
      if(value !== undefined) {
        return Number(value).valueOf();
      }
    };
  } else if (type === Boolean) {
    internalValue.$set = _baseSetter(key, 'boolean', Boolean);
    internalValue.$load = function (value) {
      if(value !== undefined) {
        return (value == 1 || value == 'true');
      }
    };
  } else if (type === Date) {
    internalValue.$set = _baseSetter(key, 'date', Date);
    internalValue.$load = function (value) {
      if(value !== undefined) {
        return new Date(value);
      }
    };
  } else if (type === ObjectID) {
    internalValue.$set = function (value) {
      if(value) {
        if(value._id) {
          if (!(value._id instanceof ObjectID)) {
            // TODO: this is wrong we should use the callbacks
            throw new Error(key + ' must be a ObjectId Object');
          }
          return value._id;
        } else {
          if (!(value instanceof ObjectID)) {
            // TODO: this is wrong we should use the callbacks
            throw new Error(key + ' must be a ObjectId Object');
          }
        }
        return value;
      }
    };
    internalValue.$store = function (value) {
      // try to extract a _id field if present
      if(value && value._id) {
        value = value._id;
      }
      return value;
    };
  } else if (type === Binary) {
    internalValue.$set = function (value) {
      if (!(value instanceof Binary)) {
        // TODO: this is wrong we should use the callbacks
        throw new Error(key + ' must be a Binary Object');
      }
      return value;
    };
  } else if (typeof(type) == 'function') {
    if (type.schema !== undefined) {
      internalValue = __buildInternalSchema(type.schema);
    } else {
      throw new Error('type of ' + key + ' is not supported, don\'t know how to implement a schema parser for it');
    }
  } else if (_isSpecial(type)) {
    internalValue = {
      $get:(type.$get !== undefined) ? (type.$get) : internalValue.$get,
      $set:(type.$set !== undefined) ? (type.$set) : internalValue.$set,
      $load:(type.$load !== undefined) ? (type.$load) : internalValue.$load
    };
  } else {
    internalValue = __buildInternalSchema(type);
  }
  return internalValue;
}

/**
 * @private
 */
function __buildInternalSchema(schema) {
  var internalSchema = {};
  for (var key in schema) {
    if (schema.hasOwnProperty(key)) {
      internalSchema[key] = __buildInternalValue(key, schema[key]);
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

  if(arguments.length === 2) {
    schema = l2cache;
    l2cache = false;
  } else if(arguments.length === 1) {
    schema = mongoCollection;
    l2cache = false;
    mongoCollection = undefined;
  }

  var odm = this;

  var internalSchema = __buildInternalSchema(schema);

  var cache = l2cache ? new Cache() : undefined;

  /**
   * @name Model
   * @class Document Model Customized class for a mongodb document schema.
   *
   * @param {Object} [values] initial values to populate an instance of this class
   * @param {Object} [options] used internally to deserialize the values
   */
  var Model = function (values, options) {
    // allow default instantiation
    if(!values) {
      values = {};
    }

    var loadOrSet = (options && options.deserialize) ? '$load' : '$set';
    var internalDocument = __initialize(internalSchema, values, loadOrSet);

    if(internalDocument === undefined) {
      // allow default instantiation
      internalDocument = {};
    }

    Object.defineProperty(this, '_internalDocument', {value: internalDocument});

    __buildValidator(internalSchema, this);

    if (options && options.deserialize) {
      this._internalDocument._id = values._id;
    }

    if(mongoCollection) {
      var self = this;

      Object.defineProperty(self, '_id', {
        get:function () {
          return self._internalDocument._id;
        },
        enumerable:true
      });
    }
  };

  /**
   * Finds one element of this collection by the given query.
   *
   * @memberOf Model
   * @param {Object} query Query object as in mongodb documentation
   * @param {Object} [options] Query options, such as skip, limit, etc
   * @param {Function} callback Callback function(error, model) with the result of the operation
   */
  Model.findOne = function (query, options, callback) {

    if(!mongoCollection) return callback('Cannot findOne on embedded model');

    if (callback === undefined) {
      callback = options;
      options = {};
    }

    odm.collection(mongoCollection, options, function (err, collection) {
      if (err) return callback(err);

      collection.findOne(query, options, function (err, documentLoaded) {
        if (err) return callback(err);
        if (documentLoaded === null) return callback(null, null);

        // special case (return direct document from mongoDB)
        if(options.directObject) return callback(null, documentLoaded);

        try {
          var model = new Model(documentLoaded, { deserialize:true });
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
   * @param {Function} callback Callback function(error, model) with the result of the operation
   */
  Model.findById = function (id, options, callback) {

    if(!mongoCollection) return callback('Cannot findById on embedded model');

    if(callback === undefined) {
      callback = options;
      options = {};
    }

    if(id === undefined) {
      callback('undefined id');
    } else {
      try {
        var _id = (id instanceof ObjectID) ? id : new ObjectID(id);

        // verify if it is in cache
        if(l2cache) {
          var cachedDocument = cache.get(_id.toHexString());

          if(cachedDocument !== undefined) {

            if (cachedDocument === null) return callback(null, null);

            // special case (return direct document from mongoDB)
            if(options.directObject) return callback(null, cachedDocument);

            try {
              var model = new Model(cachedDocument, { deserialize:true });
              return callback(null, model);
            } catch (ex) {
              return callback(ex);
            }
          }
        }

        odm.collection(mongoCollection, options, function (err, collection) {
          if (err) return callback(err);

          collection.findOne({_id: _id}, options, function (err, documentLoaded) {
            if (err) return callback(err);

            if(l2cache) {
              cache.set(_id.toHexString(), documentLoaded);
            }

            if (documentLoaded === null) return callback(null, null);

            // special case (return direct document from mongoDB)
            if(options.directObject) return callback(null, documentLoaded);

            try {
              var model = new Model(documentLoaded, { deserialize:true });
              callback(null, model);
            } catch (ex) {
              if(l2cache) {
                cache.del(_id.toHexString());
              }
              callback(ex);
            }
          });
        });
      } catch(ex) {
        callback(ex);
      }
    }
  };

  /**
   * Free form find in collection. The result is returned as a Array of this model objects.
   *
   * @memberOf Model
   * @param {Object} query MongoDB Query
   * @param {Object} [fields] filter the fields to be returned
   * @param {Object} [options] options for the query
   *        options.directObject returns the object directly from mongodb without any ODM decoration
   * @param {Function} callback Callback function(error, model) with the result of the operation
   */
  Model.find = function (query, fields, options, callback) {

    if(!mongoCollection) return callback('Cannot find on embedded model');

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
      if (err) return callback(err);

      collection.find(query, fields, options, function (err, cursor) {
        if (err) return callback(err);
        cursor.toArray(function (err, documentsLoaded) {
          if (err) return callback(err);
          // special case (return direct document from mongoDB)
          if(options.directObject) return callback(null, documentsLoaded);

          try {
            for (var i = 0; i < documentsLoaded.length; i++) {
              documentsLoaded[i] = new Model(documentsLoaded[i], { deserialize:true });
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
   * @param {Function} callback Callback function(error, model) with the result of the operation
   */
  Model.findAll = function (fields, options, callback) {

    if(!mongoCollection) return callback('Cannot findAll on embedded model');

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
    if(l2cache) {
      var cachedDocuments = cache.get('all');

      if(cachedDocuments !== undefined) {

        // special case (return direct document from mongoDB)
        if(options.directObject) return callback(null, cachedDocuments);

        try {
          var documentsLoaded = [];
          for (var i = 0; i < cachedDocuments.length; i++) {
            documentsLoaded[i] = new Model(cachedDocuments[i], { deserialize:true });
          }
          return callback(null, documentsLoaded);
        } catch (ex) {
          return callback(ex);
        }
      }
    }

    odm.collection(mongoCollection, options, function (err, collection) {
      if (err) return callback(err);

      collection.find({}, fields, options, function (err, cursor) {
        if (err) return callback(err);
        cursor.toArray(function (err, documentsLoaded) {
          if (err) return callback(err);

          if(l2cache) {
            cache.set('all', documentsLoaded);
          }

          // special case (return direct document from mongoDB)
          if(options.directObject) return callback(null, documentsLoaded);

          try {
            // do not reuse the variable documentsLoaded since it will mess with the cache
            var returnDocuments = [];
            for (var i = 0; i < documentsLoaded.length; i++) {
              returnDocuments[i] = new Model(documentsLoaded[i], { deserialize:true });
            }
            callback(null, returnDocuments);
          } catch (ex) {
            if(l2cache) {
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
   * @param {Function} callback Callback function(error, model) with the result of the operation
   */
  Model.loadDbRef = function (ids, fields, options, callback) {

    if(!mongoCollection) return callback('Cannot loadDbRef on embedded model');

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

    if (Array.isArray(ids)) {
      if(ids.length === 0) {
        callback(null, []);
      } else {
        this.find({_id:{'$in':ids}}, fields, options, callback);
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
  Model.ensureIndex = function(fieldOrSpec, options, callback) {
    if(!mongoCollection) return callback('Cannot ensureIndex on embedded model');

    if (callback === undefined) {
      callback = options;
      options = {};
    }

    odm.collection(mongoCollection, options, function (err, collection) {
      if (err) return callback(err);

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
  Model.prototype.toString = function() {
    return JSON.stringify(this._internalDocument);
  };

  /**
   * Save this object instance to the backend mongodb instance.
   *
   * @memberOf Model
   * @param {Object} [options] options for the query
   * @param {Function} callback Callback function(error, documentId) with the result of the operation
   */
  Model.prototype.save = function (options, callback) {

    if(!mongoCollection) return callback('Cannot save on embedded model');

    if (callback === undefined) {
      callback = options;
      options = {};
    }

    var self = this;

    odm.collection(mongoCollection, options, function (err, collection) {
      if (err) return callback(err);

      collection.save(self._internalDocument, options, function (err, savedDocument) {
        if (err) return callback(err);
        // only inserts have savedDocument
        if(savedDocument) {
          self._internalDocument._id = savedDocument._id;
        }
        // document updated delete from cache since it is not valid anymore
        if(l2cache) {
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
   * @param {Function} callback Callback function(error) with the result of the operation
   */
  Model.prototype.remove = function (options, callback) {

    if(!mongoCollection) return callback('Cannot remove on embedded model');

    if (callback === undefined) {
      callback = options;
      options = {};
    }

    var self = this;

    odm.collection(mongoCollection, {}, function (err, collection) {
      if (err) return callback(err);

      collection.remove({ _id: self._id }, options, function(err) {
        // document deleted, delete from cache since it is not valid anymore
        if(l2cache) {
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
   * @param {Function} callback Callback function(error) with the result of the operation
   */
  Model.remove = function (query, options, callback) {

    if(!mongoCollection) return callback('Cannot remove on embedded model');

    if (callback === undefined) {
      callback = options;
      options = {};
    }

    odm.collection(mongoCollection, {}, function (err, collection) {
      if (err) return callback(err);

      collection.remove(query, options, callback);
    });
  };

  /**
   * schema for embedded objects
   *
   * @memberOf Model
   */
  Model.schema = schema;

  // create a ref object (this is just an alias for ObjectID if we define a collection name)
  if (mongoCollection) {
    Object.defineProperty(Model, 'Ref', {value: ObjectID});
  }

  return Model;
};
