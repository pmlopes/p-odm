'use strict';

var mongodb = require('mongodb');
var ObjectID = mongodb.BSONPure.ObjectID;
var Binary = mongodb.BSONPure.Binary;

/**
 * @private
 *
 * @param {Number} times
 * @param {Function} func
 * @return {Function}
 */
function after(times, func) {

  // special case when times is zero call right away and exit
  if (times === 0) {
    return func(null);
  }

  var calls = times;
  var gotError = false;

  return function (error) {
    if (error) {
      gotError = true;
      return func(error);
    }

    if (!gotError && --calls === 0) {
      return func(null);
    }
  };
}

var LOAD_ARRAY_OF_REF = 0;
var LOAD_MODEL_VIEW = 1;
var LOAD_GENERIC = 2;

/**
 * @private
 *
 * @param {View} model
 * @param {Object} validator
 * @param {Object} options
 * @param {Function} callback
 */
function loadProperty(model, validator, options, callback) {
  var query;
  var key = validator.key;

  if (validator.type === LOAD_ARRAY_OF_REF || validator.type === LOAD_MODEL_VIEW) {
    query = model[key];
    if (query === undefined || query === null) {
      callback(null);
      return;
    }

    if (options === null) {
      options = {directObject: true};
    } else {
      options.directObject = true;
    }
  }

  switch (validator.type) {
  case LOAD_ARRAY_OF_REF:
    validator.loadDbRef(query, options, function (error, result) {
      if (error) {
        return callback(error);
      }

      model[key] = result;
      return callback(null);
    });
    break;
  case LOAD_MODEL_VIEW:
    var findFunction;

    if (query instanceof ObjectID) {
      findFunction = validator.findById;
    } else {
      findFunction = validator.findOne;
      query = {};
      query[key] = model[key];
    }

    findFunction(query, options, function (error, result) {
      if (error) {
        return callback(error);
      }

      model[key] = result;
      return callback(null);
    });
    break;
  case LOAD_GENERIC:
    validator.fn(function (error, result) {
      if (error) {
        return callback(error);
      }

      model[key] = result;
      return callback(null);
    });
    break;
  }
}

function linkProperties(src, target) {
  var i;
  for (i in src) {
    if (src.hasOwnProperty(i)) {
      var v = src[i];
      if (v === undefined) {
        continue;
      }

      if (v === null || v instanceof String || v instanceof Number || v instanceof Boolean || v instanceof Date || v instanceof ObjectID || v instanceof Binary) {
        target[i] = src[i];
      } else if (typeof src[i] === 'object') {
        if (Array.isArray(src[i])) {
          target[i] = [];
        } else {
          target[i] = {};
        }
        linkProperties(src[i], target[i]);
      } else {
        target[i] = src[i];
      }
    }
  }
}

function validate(extensions, allowModels) {

  var findFunctions = [];

  var key;
  for (key in extensions) {
    if (extensions.hasOwnProperty(key)) {
      var value = extensions[key];

      if (Array.isArray(value)) {
        if (value[0] !== undefined && value[0] !== null) {
          var hasLoadDbRef = value[0].loadDbRef !== undefined && typeof value[0].loadDbRef === 'function';
          if (hasLoadDbRef) {
            if (!allowModels) {
              throw new Error('This view does not contain a top level model, it cannot use db refs');
            }
            findFunctions.push({type: LOAD_ARRAY_OF_REF, key: key, loadDbRef: extensions[key][0].loadDbRef});
          } else {
            throw new Error(key + ' array should contain a model class');
          }
        } else {
          throw new Error(key + ' array should contain a model class');
        }
      } else {
        var hasFindById = value.findById !== undefined && typeof value.findById === 'function';
        var hasFindOne = value.findOne !== undefined && typeof value.findOne === 'function';
        var hasGenericFunction = typeof value === 'function';

        if (!hasFindById && !hasFindOne && !hasGenericFunction) {
          throw new Error(key + ' is not a Model/View or generic callback function');
        }

        if (hasFindById && hasFindOne) {
          if (!allowModels) {
            throw new Error('This view does not contain a top level model, it cannot use db finds');
          }
          findFunctions.push({type: LOAD_MODEL_VIEW, key: key, findById: extensions[key].findById, findOne: extensions[key].findOne});
          continue;
        }

        if (hasGenericFunction) {
          findFunctions.push({type: LOAD_GENERIC, key: key, fn: extensions[key]});
          continue;
        }

        throw new Error(key + ' cannot decide on which kind of find to use');
      }
    }
  }

  return findFunctions;
}

/**
 * Creates a new View class
 *
 * @memberOf ODM
 * @param {Model} [Model] Base Model to create the view from
 * @param {Object} enhances which fields get replaced with which model/view instance
 *
 * @return {View}
 */
module.exports = function (Model, enhances) {

  if (enhances === undefined) {
    // no model
    enhances = Model;
    Model = undefined;
  }

  var validator = validate(enhances, Model !== undefined);

  /**
   * @name View
   * @class Materialized View based on a model.
   */
  var View = function (document) {
    linkProperties(document, this);
  };

  var expectedCalls = validator.length;

  /**
   * @param view
   * @param [options]
   * @param callback
   */
  var load = function (view, options, callback) {
    if (callback === undefined) {
      callback = options;
      options = {};
    }

    var done = after(expectedCalls, function (error) {
      if (error) {
        return callback(error);
      }

      Object.freeze(view);
      return callback(null, view);
    });

    var i;
    for (i = 0; i < expectedCalls; i++) {
      loadProperty(view, validator[i], options, done);
    }
  };

  if (Model) {
    View.findById = function (id, options, callback) {
      if (callback === undefined) {
        callback = options;
        options = {directObject: true};
      } else {
        if (options === null) {
          options = {directObject: true};
        } else {
          options.directObject = true;
        }
      }

      Model.findById(id, options, function (error, model) {
        if (error) {
          return callback(error);
        }

        load(new View(model), options, callback);
      });
    };

    View.findOne = function (query, options, callback) {
      if (callback === undefined) {
        callback = options;
        options = {directObject: true};
      } else {
        if (options === null) {
          options = {directObject: true};
        } else {
          options.directObject = true;
        }
      }

      Model.findOne(query, options, function (error, model) {
        if (error) {
          return callback(error);
        }

        load(new View(model), options, callback);
      });
    };

  } else {
    View.find = function (callback) {
      load({}, callback);
    };
  }

  return View;
};