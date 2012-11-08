/**
 * This module contains functions related to Object Document Mapping between JavaScript and MongoDB.
 *
 * @author <a href="mailto:plopes@roughcookie.com">Paulo Lopes</a>
 */
'use strict';

/** @private */
var mongodb = require('mongodb');
/** @private */
var common = require('./common');

/**
 * @private
 * @readonly
 * @const
 *
 * @type {String}
 */
var PROTO = '__proto__';

var after = common.after;

/**
 * Creates a new View class
 *
 * @param {Model|SchemaModel} model
 * @param {Object} mapping
 *
 * @return {Function}
 */
function viewClassGenerator(model, mapping) {

  var keys = Object.keys(mapping);

  /**
   * Document Customized class for a mongodb document schema.
   * @global
   * @name View
   * @constructor
   */
  var View = function () {
  };

  var stitch = function (key, document, callback) {
    var done = after(keys.length, function (error) {
      if (error) {
        return callback(error);
      }

      console.log(document[PROTO]);

      // apply this view prototype to the document prototype
      var func;
      for (func in View.prototype) {
        if (View.prototype.hasOwnProperty(func)) {
          console.log('Patching', func);
          document[PROTO][func] = View.prototype[func];
        }
      }

      return callback(null, document);
    });

    return function (error, result) {
      if (error) {
        return done(error);
      }

      document[key] = result;
      return done(null);
    };
  };

  /**
   * Finds one element of this collection by the given query.
   *
   * @static
   * @memberOf View
   * @param {Object} query Query object as in mongodb documentation
   * @param {Function} callback Callback function (error, model) with the result of the operation
   */
  View.findOne = function (query, callback) {

    model.findOne(query, function (error, document) {
      if (error) {
        return callback(error);
      }

      // fast exit
      if (document === null) {
        return callback(null);
      }

      // load mappings
      var i;
      for (i = 0; i < keys.length; i++) {
        var key = keys[i];
        mapping[key].loadDbRef(document[key], stitch(key, document, callback));
      }
    });
  };

  /**
   * Finds one element of this collection by the given query.
   *
   * @static
   * @memberOf View
   * @param {ObjectId} id
   * @param {Function} callback Callback function (error, model) with the result of the operation
   */
  View.findById = function (id, callback) {

    model.findById(id, function (error, document) {
      if (error) {
        return callback(error);
      }

      // fast exit
      if (document === null) {
        return callback(null);
      }

      // load mappings
      var i;
      for (i = 0; i < keys.length; i++) {
        var key = keys[i];
        mapping[key].loadDbRef(document[key], stitch(key, document, callback));
      }
    });
  };

  return View;
}

module.exports = viewClassGenerator;