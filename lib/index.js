'use strict';

var mongodb = require('mongodb');
var ObjectID = mongodb.BSONPure.ObjectID;
var Binary = mongodb.BSONPure.Binary;

// lazy connector
var _collections = {};
var _connected = false;
var _connecting = false;

var _url = null;
var _options = null;

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
          console.error(err);
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
      if (this.queryCache !== null) {
        this.queryCache.reset();
      }
    }
  },

  /**
   * Removes all the collections from the database
   *
   * @memberOf ODM
   * @param {Function} [callback] Callback to call once done
   */
  removeAllCollections: function(callback) {
    var self = this;
    this.db.collectionNames(function (err, collectionNames) {
      if (err) {
        return callback(err);
      }

      var counter = collectionNames.length;

      collectionNames.forEach(function (collectionName) {
        self.db.dropCollection(collectionName.name.substr(collectionName.name.lastIndexOf('.') + 1), function (err) {
          if (err) {
            return callback(err);
          }

          if (--counter === 0) {
            callback(null);
          }
        });
      });
    });
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
    this.collection(collection_name, options, function (err, collection) {
      if (err) {
        return callback(err);
      }

      collection.find(query, fields, options, function (err, cursor) {
        if (err) {
          return callback(err);
        }
        cursor.toArray(callback);
      });
    });
  },

  save: function (collection_name, document, options, callback) {
    this.collection(collection_name, options, function (err, collection) {
      if (err) {
        return callback(err);
      }

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
   * Creates a new Document Model class
   *
   * @memberOf ODM
   * @param {String} [mongoCollection] Collection name, if not present this is an embedded document
   * @param {Object} schema
   *
   * @return {Model}
   */
  model: require('./model.js'),

  /**
   * Document is a short for mongo documents, it allows you to get the raw document from mongo when
   * schema validation is not required on not possible.
   *
   * At the moment if only allows you to find and find one
   * @param {String} mongoCollection
   * @param {Boolean} [l2cache] Enable Query Cache for FindAll
   */
  document: require('./document.js')
};

module.exports = ODM;