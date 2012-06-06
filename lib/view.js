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
 * @param {String} attrib
 * @param {View} model
 * @param {Object} enhances
 * @param {Object} options
 * @param {Function} callback
 */
function findAttrib(attrib, model, enhances, validator, options, callback) {
  var query = model[attrib];

  switch (validator[attrib]) {
  case LOAD_ARRAY_OF_REF:
    if (query === undefined || query === null) {
      callback(null);
      return;
    }

    if (options === null) {
      options = {directObject: true};
    } else {
      options.directObject = true;
    }

    enhances[attrib][0].loadDbRef(query, options, function (error, result) {
      if (error) {
        return callback(error);
      }

      model[attrib] = result;
      return callback(null);
    });
    break;
  case LOAD_MODEL_VIEW:
    if (query === undefined || query === null) {
      callback(null);
      return;
    }

    if (options === null) {
      options = {directObject: true};
    } else {
      options.directObject = true;
    }

    var findFunction;

    if (query instanceof ObjectID) {
      findFunction = enhances[attrib].findById;
    } else {
      findFunction = enhances[attrib].findOne;
      query = {};
      query[attrib] = model[attrib];
    }

    findFunction(query, options, function (error, result) {
      if (error) {
        return callback(error);
      }

      model[attrib] = result;
      return callback(null);
    });
    break;
  case LOAD_GENERIC:
    enhances[attrib](function (error, result) {
      if (error) {
        return callback(error);
      }

      model[attrib] = result;
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

function validate(extensions) {

  var findFunctions = {};

  var key;
  for (key in extensions) {
    if (extensions.hasOwnProperty(key)) {
      var value = extensions[key];

      if (Array.isArray(value)) {
        if (value[0] !== undefined && value[0] !== null) {
          var hasLoadDbRef = value[0].loadDbRef !== undefined && typeof value[0].loadDbRef === 'function';
          if (hasLoadDbRef) {
            findFunctions[key] = LOAD_ARRAY_OF_REF;
          } else {
            throw new Error(key + ' array[0] should contain a Model class');
          }
        } else {
          throw new Error(key + ' array should contain a Model class');
        }
      } else {
        var hasFindById = value.findById !== undefined && typeof value.findById === 'function';
        var hasFindOne = value.findOne !== undefined && typeof value.findOne === 'function';
        var hasGenericFunction = typeof value === 'function';

        if (!hasFindById && !hasFindOne && !hasGenericFunction) {
          throw new Error(key + ' is not a Model/View or generic callback function');
        }

        if (hasFindById && hasFindOne) {
          findFunctions[key] = LOAD_MODEL_VIEW;
          continue;
        }

        if (hasGenericFunction) {
          findFunctions[key] = LOAD_GENERIC;
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
 * @param {Model} Model Base Model to create the view from
 * @param {Object} enhances which fields get replaced with which model/view instance
 *
 * @return {View}
 */
module.exports = function (Model, enhances) {

  var validator = validate(enhances);

  /**
   * @name View
   * @class Materialized View based on a model.
   */
  var View = function (document) {
    linkProperties(document, this);
  };

  var expectedCalls = Object.keys(enhances).length;

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

      var view = new View(model);

      var done = after(expectedCalls, function (error) {
        if (error) {
          return callback(error);
        }

        Object.freeze(view);
        return callback(null, view);
      });

      var prop;
      for (prop in enhances) {
        if (enhances.hasOwnProperty(prop)) {
          findAttrib(prop, view, enhances, validator, options, done);
        }
      }
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

      if (model === null) {
        return callback(null, null);
      }

      var view = new View(model);

      var done = after(expectedCalls, function (error) {
        if (error) {
          return callback(error);
        }

        Object.freeze(view);
        return callback(null, view);
      });

      var prop;
      for (prop in enhances) {
        if (enhances.hasOwnProperty(prop)) {
          findAttrib(prop, view, enhances, validator, options, done);
        }
      }
    });
  };

  return View;
};