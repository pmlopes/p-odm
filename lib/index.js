var mongodb = require('mongodb');
var ObjectID = mongodb.BSONPure.ObjectID;
var Binary = mongodb.BSONPure.Binary;

var Cache = require('./cache');

// lazy connector
var _collections = {};
var _connected = false;
var _connecting = false;
var _db = null;

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
   * Defines the connection url for all models
   *
   * @memberOf ODM
   * @param {String} url mongodb connection string
   *  The format is: mongodb://<server>:<port>/<database>
   * @param {Object} [options] Options passed to the native driver
   */
  connect: function(url, options) {
    // disconnect any open connection
    this.disconnect();

    _url = url;
    _options = options;
    _connected = false;
    _collections = {};
  },

  /**
   * Disconnects from the database
   * If not connected this is a no-op operation.
   *
   * @memberOf ODM
   */
  disconnect: function() {
    if (_db) {
      _db.close();
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
  collection: function(collection_name, options, callback) {

    if (callback === undefined) {
      callback = options;
      options = {};
    }

    if(_connecting) {
      var odm = this;
      // delay this request since we are in transit to get a new connection
      process.nextTick(function() {
        odm.collection(collection_name, options, callback);
      });
    }

    else if(!_connected) {
      if(!_url) return callback('No Connection defined.');

      mongodb.connect(_url, _options, function(err, db) {
        // flag we are done with the connection wait
        _connecting = false;

       if(err) return callback(err);

        _db = db;
        _connected = true;

        if (_collections[collection_name]) {
          callback(null, _collections[collection_name]);
        } else {
          _db.collection(collection_name, options, function(err, collection) {
            if (!err) {
              _collections[collection_name] = collection;
            }
            callback(err, collection);
          });
        }
      });

      // flag we are waiting
      _connecting = true;
    } else {
      if (_collections[collection_name]) {
        callback(null, _collections[collection_name]);
      } else {
        _db.collection(collection_name, options, function(err, collection) {
          if (!err) {
            _collections[collection_name] = collection;
          }
          callback(err, collection);
        });
      }
    }
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
  document: function(mongoCollection, l2cache) {

    var odm = this;

    var cache = l2cache ? new Cache() : undefined;

    var Model = function() {
      throw new Error('Documents are read only and cannot be instantiated');
    };

    Model.findOne = function(query, fields, options, callback) {

      if (callback === undefined) {
        callback = options;
        options = {};
      }

      odm.collection(mongoCollection, options, function (err, collection) {
        if (err) return callback(err);

        collection.findOne(query, options, function (err, documentLoaded) {
          if (err) return callback(err);

          return callback(null, documentLoaded);
        });
      });
    };

    Model.find = function(query, fields, options, callback) {

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

            return callback(null, documentsLoaded);
          });
        });
      });
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

      // verify if it is in cache
      if(l2cache) {
        var cachedDocuments = cache.get('all');
        if(cachedDocuments !== undefined) {
          return callback(null, cachedDocuments);
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

            return callback(null, documentsLoaded);
          });
        });
      });
    };


    return Model;
  }
};

module.exports = ODM;