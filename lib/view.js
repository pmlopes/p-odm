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
 * @param {Function} callback
 */
function findAttrib (attrib, model, enhances, callback) {
  if (model[attrib] === undefined || model[attrib] === null) {
    callback();
    return;
  }

  enhances[attrib].findById(model[attrib], {directObject: true}, function (error, submodel) {
    if (error) {
      return callback(error);
    }

    model[attrib] = submodel;
    return callback();
  });
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

  View.findById = function (id, callback) {
    Model.findById(id, {directObject: true}, function (error, model) {
      if (error) {
        return callback(error);
      }

      var done = after(expectedCalls, function (error) {
        if (error) {
          return callback(error);
        }

        var protoKeys = Object.keys(View.prototype);
        var i;
        for (i = 0; i < protoKeys.length; i++) {
          var key = protoKeys[i];
          model.__proto__[key] = View.prototype[key];
        }

        Object.freeze(model);
        return callback(null, model);
      });

      var prop;
      for (prop in enhances) {
        if (enhances.hasOwnProperty(prop)) {
          findAttrib(prop, model, enhances, done);
        }
      }
    });
  };

  View.findOne = function (query, callback) {
    Model.findOne(query, {directObject: true}, function (error, model) {
      if (error) {
        return callback(error);
      }

      var done = after(expectedCalls, function (error) {
        if (error) {
          return callback(error);
        }

        var protoKeys = Object.keys(View.prototype);
        var i;
        for (i = 0; i < protoKeys.length; i++) {
          var key = protoKeys[i];
          model.__proto__[key] = View.prototype[key];
        }

        Object.freeze(model);
        return callback(null, model);
      });

      var prop;
      for (prop in enhances) {
        if (enhances.hasOwnProperty(prop)) {
          findAttrib(prop, model, enhances, done);
        }
      }
    });
  };

  return View;
};