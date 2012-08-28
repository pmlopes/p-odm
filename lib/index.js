'use strict';

var fs = require('fs');
var mongodb = require('mongodb');
var ObjectID = mongodb.BSONPure.ObjectID;
var Binary = mongodb.BSONPure.Binary;
var Cursor = mongodb.Cursor;
var arrayHelper = require('./helpers/arrays');

var baseModel = require('./protos/freemodel');
var schemaModel = require('./protos/schemamodel');
var embedSchemaModel = require('./protos/embedschemamodel');

var common = require('./protos/common');

var Validator = require('jsonschema');

function Environment() {
  this.schemas = {};
  return this;
}

Environment.prototype.addSchema = function (schema, urn) {
  var ourUrn = urn;

  if (!schema) {
    return null;
  }

  if (!urn) {
    ourUrn = schema.id;
  }
  if (ourUrn) {
    this.schemas[ourUrn] = schema;
  }
  return this.schemas[ourUrn];
};

Environment.prototype.validate = function (instance, schema) {
  var v = new Validator();
  v.setSchemas(this.schemas);
  return v.validate(instance, schema);
};

var schema = new Environment();

// lazy connector
var _collections = {};
var _connected = false;
var _connecting = false;

var _url = null;
var _options = null;

var _safeOptions = null;

var  extractOption = common.extractOption;

/**
 * Object Document Model
 * @name ODM
 * @static
 * @class
 */
var ODM = {
  /**
   * @static
   * @memberOf ODM
   */
  ObjectId: ObjectID,
  /**
   * @static
   * @memberOf ODM
   */
  Binary: Binary,
  /**
   * @static
   * @memberOf ODM
   */
  db: null,

  /**
   * Defines the connection url for all models
   *
   * @static
   * @memberOf ODM
   * @param {String} url mongodb connection string, The format is: mongodb://<server>:<port>/<database>
   * @param {Object} [options] Options passed to the native driver
   * @param {Function} [callback] Callback if we want to connect right away
   */
  connect: function (url, options, callback) {
    // disconnect any open connection
    ODM.disconnect();

    _url = url;
    _options = options;
    _connected = false;
    _collections = {};
    _safeOptions = extractOption('safe', options);

    if (callback !== undefined) {
      mongodb.connect(_url, _options, function (err, db) {
        // flag we are done with the connection wait
        _connecting = false;

        if (err) {
          return callback(err);
        }

        ODM.db = db;

        ODM.db.on('close', function (err) {
          // clear collection cache
          _collections = {};
          if (err) {
            console.error(err);
          }
        });

        _connected = true;
        _collections = {};

        return callback(null);
      });

      // flag we are waiting
      _connecting = true;
    }
    return null;
  },

  /**
   * Disconnects from the database
   * If not connected this is a no-op operation.
   *
   * @static
   * @memberOf ODM
   * @param {Function} [callback] Callback if we want to connect right away
   */
  disconnect: function (callback) {
    if (ODM.db) {
      if (callback !== undefined) {
        ODM.db.close(callback);
      } else {
        ODM.db.close();
      }
      // clear collection cache
      _collections = {};
      _connected = false;
      _connecting = false;
    }
  },

  /**
   * Gets a collection object from the native driver
   *
   * @static
   * @memberOf ODM
   * @param {String} collection_name mongodb collection name
   * @param {Object} [options] Options passed to the native driver
   * @param {Function} callback Callback function(err, collection)
   */
  collection: function (collection_name, options, callback) {

    if (callback === undefined) {
      callback = options;
      options = {};
    }

    if (_connecting) {
      // delay this request since we are in transit to get a new connection
      return setTimeout(function () {
        ODM.collection(collection_name, options, callback);
      }, 300);
    } else if (!_connected) {
      if (!_url) {
        return callback('No Connection defined.');
      }

      mongodb.connect(_url, _options, function (err, db) {
        // flag we are done with the connection wait
        _connecting = false;

        if (err) {
          return callback(err);
        }

        ODM.db = db;
        _connected = true;
        _collections = {};

        return ODM.db.collection(collection_name, options, function (err, collection) {
          if (!err) {
            _collections[collection_name] = collection;
          }
          callback(err, collection);
        });
      });

      // flag we are waiting
      _connecting = true;
      return null;
    } else {
      if (_collections[collection_name]) {
        return callback(null, _collections[collection_name]);
      } else {
        return ODM.db.collection(collection_name, options, function (err, collection) {
          if (!err) {
            _collections[collection_name] = collection;
          }
          return callback(err, collection);
        });
      }
    }
  },

  /**
   * @static
   * @memberOf ODM
   *
   * @param {String} collection_name
   * @param {Object} query
   * @param {Object} fields
   * @param {Object} options
   * @param {Function} callback
   */
  findOne: function (collection_name, query, fields, options, callback) {
    ODM.collection(collection_name, options, function (err, collection) {
      if (err) {
        return callback(err);
      }

      return collection.findOne(query, fields, options, callback);
    });
  },

  /**
   * @static
   * @memberOf ODM
   *
   * @param {String} collection_name
   * @param {Object} query
   * @param {Object} fields
   * @param {Object} options
   * @param {Function} callback
   */
  find: function (collection_name, query, fields, options, callback) {
    var wantCursor = extractOption('cursor', options, false);

    ODM.collection(collection_name, options, function (err, collection) {
      if (err) {
        return callback(err);
      }

      return collection.find(query, fields, options, function (err, cursor) {
        if (err) {
          return callback(err);
        }

        if (wantCursor) {
          if (cursor.state !== Cursor.CLOSED) {
            return callback(null, cursor);
          } else {
            return callback('Cursor is closed');
          }
        }

        return cursor.toArray(function (err, array) {
          if (err) {
            return callback(err);
          }

          callback(null, array);

          // clean resources
          if (!cursor.isClosed()) {
            cursor.close();
          }
        });
      });
    });
  },

  /**
   * @static
   * @memberOf ODM
   * @param {String} collection_name
   * @param {Object} query
   * @param {Object} options
   * @param {Function} callback
   */
  count: function (collection_name, query, options, callback) {
    ODM.collection(collection_name, options, function (err, collection) {
      if (err) {
        return callback(err);
      }

      return collection.find(query, options).count(callback);
    });
  },

  /**
   * @static
   * @memberOf ODM
   *
   * @param {String} collection_name
   * @param {Object|Object[]}documents
   * @param {Object} options
   * @param {Function} callback
   */
  insert: function (collection_name, documents, options, callback) {
    ODM.collection(collection_name, options, function (err, collection) {
      if (err) {
        return callback(err);
      }

      options.safe = _safeOptions;
      return collection.insert(documents, options, callback);
    });
  },

  /**
   * @static
   * @memberOf ODM
   *
   * @param {String} collection_name
   * @param {Object} criteria
   * @param {Object} document
   * @param {Object} options
   * @param {Function} callback
   */
  update: function (collection_name, criteria, document, options, callback) {
    ODM.collection(collection_name, options, function (err, collection) {
      if (err) {
        return callback(err);
      }

      options.safe = _safeOptions;
      return collection.update(criteria, document, options, callback);
    });
  },

  /**
   * @static
   * @memberOf ODM
   *
   * @param {String} collection_name
   * @param {Object} document
   * @param {Object} options
   * @param {Function} callback
   */
  save: function (collection_name, document, options, callback) {
    ODM.collection(collection_name, options, function (err, collection) {
      if (err) {
        return callback(err);
      }

      options.safe = _safeOptions;
      return collection.save(document, options, callback);
    });
  },

  /**
   * @static
   * @memberOf ODM
   *
   * @param {String} collection_name
   * @param {Object} query
   * @param {Object} options
   * @param {Function} callback
   */
  remove: function (collection_name, query, options, callback) {
    ODM.collection(collection_name, options, function (err, collection) {
      if (err) {
        return callback(err);
      }

      return collection.remove(query, options, callback);
    });
  },

  /**
   * JSON Schema validator functions
   */
  createSchema: schema.addSchema.bind(schema),
  validate: schema.validate.bind(schema),

  /**
   * Creates a new Document Model class
   *
   * @static
   * @memberOf ODM
   * @param {Object} schemaDef
   *
   * @return {Function}
   */
  embeddedModel: function (schemaDef) {
    if (schemaDef !== undefined && schemaDef !== null) {
      return embedSchemaModel(ODM, schemaDef);
    }

    throw new Error('Cannot instantiate model without schema and collection');
  },

  /**
   * Creates a new Document Model class
   *
   * @static
   * @memberOf ODM
   * @param {String} mongoCollection Collection name, if not present this is an embedded document
   *
   * @return {Function}
   */
  basicModel: function (mongoCollection) {
    if (mongoCollection !== undefined) {
      return baseModel(ODM, mongoCollection);
    }

    throw new Error('Cannot instantiate model without schema and collection');
  },

  /**
   * Creates a new Document Model class
   *
   * @static
   * @memberOf ODM
   * @param {String} mongoCollection Collection name, if not present this is an embedded document
   * @param {Object|String} schemaDef
   *
   * @return {Function}
   */
  schemaModel: function (mongoCollection, schemaDef) {
    if (schemaDef !== undefined && schemaDef !== null) {
      if (mongoCollection !== undefined) {
        return schemaModel(ODM, mongoCollection, schemaDef);
      }
    }

    throw new Error('Cannot instantiate model without schema and collection');
  },

  subgraph: function (name, options, schemas) {

    var subgraph = {
      label: name,
      records: '',
      references: ''
    };

    var header =
      'subgraph cluster_' + name + ' {\n' +
      'label="' + name + '"\n';

    // iterate through all collections in schemas
    schemas.forEach(function (schema) {
      var collectionName = schema.id;

      // add table to record
      subgraph.records += '"' + collectionName + '" [\n';
      // begin fields
      subgraph.records += '  label = "<f0> ' + collectionName;
      var fieldNumber = 0;

      // iterate through all properties in table
      var propertyName;
      var type;
      var items;

      for (propertyName in schema.properties) {
        if (schema.properties.hasOwnProperty(propertyName)) {
          var property = schema.properties[propertyName];
          fieldNumber++;

          type = property.type;

          if (property.$ref) {
            type = property.$ref;
            // only ObjectId props are dbrefs
            if (property.$ref === 'MongoDb#ObjectId') {
              if (property.description) {
                options.refNum++;
                // add references
                subgraph.references += '"' + collectionName + '":f' + fieldNumber + ' -> "' + property.description + '":f0 [id = ' + options.refNum + '];\n';
              }
            }
          }

          if (property.type === 'array') {
            items = property.items;
            type = items.type + '[]';

            if (items.$ref) {
              type = items.$ref + '[]';
              // only ObjectId props are dbrefs
              if (items.$ref === 'MongoDb#ObjectId') {
                if (items.description) {
                  options.refNum++;
                  // add references
                  subgraph.references += '"' + collectionName + '":f' + fieldNumber + ' -> "' + items.description + '":f0 [id = ' + options.refNum + '];\n';
                }
              }
            }
          }

          if (Array.isArray(property.type)) {
            if (property.type.length === 2 && (property.type[0] === 'null' || property.type[1] === 'null')) {
              // null or something
              var prop;
              if (property.type[0] === 'null') {
                prop = property.type[1];
                type = '?' + prop;
              } else {
                prop = property.type[0];
                type = '?' + prop;
              }
            }

            if (prop.$ref) {
              type = '?' + prop.$ref;
              // only ObjectId props are dbrefs
              if (prop.$ref === 'MongoDb#ObjectId') {
                if (prop.description) {
                  options.refNum++;
                  // add references
                  subgraph.references += '"' + collectionName + '":f' + fieldNumber + ' -> "' + prop.description + '":f0 [id = ' + options.refNum + '];\n';
                }
              }
            }

            if (prop.type === 'array') {
              items = prop.items;
              type = '?' + items.type + '[]';

              if (items.$ref) {
                type = items.$ref + '[]';
                // only ObjectId props are dbrefs
                if (items.$ref === 'MongoDb#ObjectId') {
                  if (items.description) {
                    options.refNum++;
                    // add references
                    subgraph.references += '"' + collectionName + '":f' + fieldNumber + ' -> "' + items.description + '":f0 [id = ' + options.refNum + '];\n';
                  }
                }
              }
            }
          }

          // add fields to record
          subgraph.records += '| <f' + fieldNumber + '> ' + propertyName + ':\\{' + type + '\\}\\l';
        }
      }

      subgraph.records += '"\n' +
        '  shape = "record"\n' +
        '];\n';
    });

    return subgraph;
  },

  graph: function (filename, schemas, callback) {
    var graph =
      'digraph g {\n' +
      'graph [rankdir = "LR"];\n' +
      'node [fontsize = "10" shape = "ellipse"];\n' +
      'edge [];\n';

    // each reference must have a unique id
    var options = {
      refNum: 0
    };

    var references = '';

    var cluster;
    for (cluster in schemas) {
      if (schemas.hasOwnProperty(cluster)) {
        var subgraph = ODM.subgraph(cluster, options, schemas[cluster]);

        graph += 'subgraph cluster_' + cluster + ' {\n' +
                 'label="' + cluster + '"\n';

        graph += subgraph.records + '}\n';
        references += subgraph.references;
      }
    }

    fs.writeFile(filename, graph + references + '}\n', callback);
  },

  /**
   * Helper functions to work with arrays
   */
  array: arrayHelper
};

module.exports = ODM;

// Initialization

schema.addSchema({
  "type": "object",
  "id": "MongoDb#ObjectId",
  "description": "MongoDB ObjectID",
  "properties": {
    "id": {"type": "string"},
    "_bsontype": {"type": "string"}
  }
}, "MongoDb#ObjectId");