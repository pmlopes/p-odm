'use strict';

var util = require('../protos/common');

/**
 * @param {Object} query
 * @param callback
 */
module.exports = function (query, callback) {

  var resultSet = {};

  var keys = Object.keys(query);

  var done = util.after(keys.length, function (error) {
    if (error) {
      return callback(error);
    }

    return callback(null, resultSet);
  });

  var process = function (key) {
    return function (error, document) {
      if (error) {
        return done(error);
      }

      resultSet[key] = document;
      return done(null);
    };
  };

  var i;
  for (i = 0; i < keys.length; i++) {
    var finder = query[keys[i]];
    if (finder.options === undefined) {
      if (finder.fields === undefined) {
        // no options, no fields
        finder.fn(finder.query, process(keys[i]));
      } else {
        // don't know how to handle this
        done('finder without options but with fields is not supported');
      }
    } else {
      if (finder.fields === undefined) {
        // options, no fields
        finder.fn(finder.query, finder.options, process(keys[i]));
      } else {
        // options, fields
        finder.fn(finder.query, finder.fields, finder.options, process(keys[i]));
      }
    }
  }
};