'use strict';

var util = require('../protos/common');

/**
 * @param {{model: Model, key: String, id: ObjectId}[]} query
 * @param options
 * @param callback
 */
function findById(query, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  var result = {};

  var done = util.after(query.length, function (error) {
    if (error) {
      return callback(error);
    }

    return callback(null, result);
  });

  var process = function (key) {
    return function (error, document) {
      if (error) {
        return done(error);
      }

      result[key] = document;
      return done(null);
    };
  };

  var i;
  for (i = 0; i < ids.length; i++) {
    query[i].model.findById(query[i].id, options, process(query[i].key));
  }
}

/**
 * @param {{model: Model, key: String, id: ObjectId}[]} query
 * @param options
 * @param callback
 */
function findOne(query, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  var result = {};

  var done = util.after(query.length, function (error) {
    if (error) {
      return callback(error);
    }

    return callback(null, result);
  });

  var process = function (key) {
    return function (error, document) {
      if (error) {
        return done(error);
      }

      result[key] = document;
      return done(null);
    };
  };

  var i;
  for (i = 0; i < ids.length; i++) {
    query[i].model.findOne(query[i].id, options, process(query[i].key));
  }
}

/**
 * @param {{model: Model, key: String, id: Object}[]} query
 * @param options
 * @param callback
 */
function find(query, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  var result = {};

  var done = util.after(query.length, function (error) {
    if (error) {
      return callback(error);
    }

    return callback(null, result);
  });

  var process = function (key) {
    return function (error, document) {
      if (error) {
        return done(error);
      }

      result[key] = document;
      return done(null);
    };
  };

  var i;
  for (i = 0; i < ids.length; i++) {
    query[i].model.find(query[i].id, options, process(query[i].key));
  }
}

/**
 * @param {{model: Model, key: String}[]} query
 * @param options
 * @param callback
 */
function findAll(query, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  var result = {};

  var done = util.after(query.length, function (error) {
    if (error) {
      return callback(error);
    }

    return callback(null, result);
  });

  var process = function (key) {
    return function (error, document) {
      if (error) {
        return done(error);
      }

      result[key] = document;
      return done(null);
    };
  };

  var i;
  for (i = 0; i < ids.length; i++) {
    query[i].model.findAll(options, process(query[i].key));
  }
}

module.exports = {
  findById: findById,
  findOne: findOne,
  find: find,
  findAll: findAll
};