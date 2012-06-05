'use strict';

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

/**
 * @private
 *
 * @param {String} attrib
 * @param {Model} model
 * @param {Object} enhances
 * @param {Object} options
 * @param {Function} callback
 */
function findAttrib (attrib, model, enhances, options, callback) {
  if (model[attrib] === undefined || model[attrib] === null) {
    callback(null);
    return;
  }

  var findFunction;

  if (Array.isArray(enhances[attrib])) {
    findFunction = enhances[attrib][0].loadDbRef;
  } else {
    findFunction = enhances[attrib].findById;
  }

  if (options === null) {
    options = {directObject: true};
  } else {
    options.directObject = true;
  }

  findFunction(model[attrib], options, function (error, result) {
    if (error) {
      return callback(error);
    }

    model[attrib] = result;
    return callback(null);
  });
}

function extend(baseClass, objInstance) {
  if (baseClass.prototype !== undefined && baseClass.prototype !== null) {
    var protoKeys = Object.keys(baseClass.prototype);
    var i;
    for (i = 0; i < protoKeys.length; i++) {
      var key = protoKeys[i];
      objInstance.__proto__[key] = baseClass.prototype[key];
    }
  }
  Object.freeze(objInstance);
  return objInstance;
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

  /**
   * @name View
   * @class Materialized View based on a model.
   */
  var View = Object.create({});
  var expectedCalls = Object.keys(enhances).length;
  // TODO: validate enhances to have only Models/Views or Arrays of Models/Views

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

      var done = after(expectedCalls, function (error) {
        if (error) {
          return callback(error);
        }

        return callback(null, extend(View, model));
      });

      var prop;
      for (prop in enhances) {
        if (enhances.hasOwnProperty(prop)) {
          findAttrib(prop, model, enhances, options, done);
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

      var done = after(expectedCalls, function (error) {
        if (error) {
          return callback(error);
        }

        return callback(null, extend(View, model));
      });

      var prop;
      for (prop in enhances) {
        if (enhances.hasOwnProperty(prop)) {
          findAttrib(prop, model, enhances, options, done);
        }
      }
    });
  };

  return View;
};