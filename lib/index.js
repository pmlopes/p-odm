'use strict';

var mongodb = require('mongodb');
var ObjectID = mongodb.BSONPure.ObjectID;
var Binary = mongodb.BSONPure.Binary;

var JSV = require("JSV").JSV;
var schema = JSV.createEnvironment("json-schema-draft-03");

var objectIdRegExp = /^[0-9a-fA-F]{24}$/;
var ISO8601RegExp = /^(\d{4})\D?(0[1-9]|1[0-2])\D?([12]\d|0[1-9]|3[01])(\D?([01]\d|2[0-3])\D?([0-5]\d)\D?([0-5]\d)?\D?(\d{3})?([zZ]|([\+\-])([01]\d|2[0-3])\D?([0-5]\d)?)?)?$/;

// lazy connector
var _collections = {};
var _connected = false;
var _connecting = false;

var _url = null;
var _options = null;

var _safeOptions = null;

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
 * @class ODM Object Document Model
 */
var ODM = {
  /**
   * @memberOf ODM
   */
  ObjectId: ObjectID,
  /**
   * @memberOf ODM
   */
  Binary: Binary,
  /**
   * @memberOf ODM
   */
  db: null,

  /**
   * Defines the connection url for all models
   *
   * @memberOf ODM
   * @param {String} url mongodb connection string, The format is: mongodb://<server>:<port>/<database>
   * @param {Object} [options] Options passed to the native driver
   * @param {Function} [callback] Callback if we want to connect right away
   */
  connect: function (url, options, callback) {
    var self = this;
    // disconnect any open connection
    self.disconnect();

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

        self.db = db;

        self.db.on('close', function (err) {
          // clear collection cache
          _collections = {};
          if (err) {
            console.error(err);
          }
        });

        _connected = true;
        _collections = {};

        callback(null);
      });

      // flag we are waiting
      _connecting = true;
    }
  },

  /**
   * Disconnects from the database
   * If not connected this is a no-op operation.
   *
   * @memberOf ODM
   * @param {Function} [callback] Callback if we want to connect right away
   */
  disconnect: function (callback) {
    if (this.db) {
      if (callback !== undefined) {
        this.db.close(callback);
      } else {
        this.db.close();
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

    var self = this;

    if (_connecting) {
      var odm = this;
      // delay this request since we are in transit to get a new connection
      setTimeout(function () {
        odm.collection(collection_name, options, callback);
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

        self.db = db;
        _connected = true;
        _collections = {};

        self.db.collection(collection_name, options, function (err, collection) {
          if (!err) {
            _collections[collection_name] = collection;
          }
          callback(err, collection);
        });
      });

      // flag we are waiting
      _connecting = true;
    } else {
      if (_collections[collection_name]) {
        callback(null, _collections[collection_name]);
      } else {
        self.db.collection(collection_name, options, function (err, collection) {
          if (!err) {
            _collections[collection_name] = collection;
          }
          callback(err, collection);
        });
      }
    }
  },

  findOne: function (collection_name, query, fields, options, callback) {
    this.collection(collection_name, options, function (err, collection) {
      if (err) {
        return callback(err);
      }

      collection.findOne(query, fields, options, callback);
    });
  },

  find: function (collection_name, query, fields, options, callback) {
    var stream = extractOption('stream', options, false);

    this.collection(collection_name, options, function (err, collection) {
      if (err) {
        return callback(err);
      }

      collection.find(query, fields, options, function (err, cursor) {
        if (err) {
          return callback(err);
        }

        if (stream) {
          return callback(cursor);
        }

        cursor.toArray(callback);
      });
    });
  },

  insert: function (collection_name, documents, options, callback) {
    this.collection(collection_name, options, function (err, collection) {
      if (err) {
        return callback(err);
      }

      options.safe = _safeOptions;
      collection.insert(documents, options, callback);
    });
  },

  update: function (collection_name, criteria, document, options, callback) {
    this.collection(collection_name, options, function (err, collection) {
      if (err) {
        return callback(err);
      }

      options.safe = _safeOptions;
      collection.update(criteria, document, options, callback);
    });
  },

  save: function (collection_name, document, options, callback) {
    this.collection(collection_name, options, function (err, collection) {
      if (err) {
        return callback(err);
      }

      options.safe = _safeOptions;
      collection.save(document, options, callback);
    });
  },

  remove: function (collection_name, query, options, callback) {
    this.collection(collection_name, options, function (err, collection) {
      if (err) {
        return callback(err);
      }

      collection.remove(query, options, callback);
    });
  },

  /**
   * JSON Schema validator functions
   */
  createSchema: schema.createSchema.bind(schema),
  validate: schema.validate.bind(schema),

  /**
   * Creates a new Document Model class
   *
   * @memberOf ODM
   * @param {String} [mongoCollection] Collection name, if not present this is an embedded document
   * @param {Object} schema
   *
   * @return {Model}
   */
  model: require('./model'),

  /**
   * Parses a JSON string to a JSON document. It is aware of ISO Dates and ObjectIds and coverts them on the fly.
   *
   * @param jsonString
   * @return {Object} JSON
   */
  parse: function (jsonString) {
    return JSON.parse(jsonString, function (key, value) {
      if (typeof value === 'string') {
        // try to see if are receiving a string representation of an ObjectId
        if (value.length === 24 && objectIdRegExp.test(value)) {
          return ObjectID.createFromHexString(value);
        }
        // try to see if we are receiving an ISO string
        if (ISO8601RegExp.test(value)) {
          return new Date(Date.parse(value));
        }
      }
      return value;
    });
  }
};

module.exports = ODM;