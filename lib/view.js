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
  var View = Object.create(null);
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

        var frozenModel = Object.freeze(model);
        return callback(null, frozenModel);
      });

      var findAttrib = function (attrib) {
        if (model[attrib] === undefined || model[attrib] === null) {
          return done();
        }

        enhances[attrib].findById(model[attrib], {directObject: true}, function (error, submodel) {
          if (error) {
            return done(error);
          }

          model[attrib] = submodel;
          return done();
        });
      };

      var attrib;
      for (attrib in enhances) {
        if (enhances.hasOwnProperty(attrib)) {
          findAttrib(attrib);
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

        var frozenModel = Object.freeze(model);
        return callback(null, frozenModel);
      });

      var findAttrib = function (attrib) {
        if (model[attrib] === undefined || model[attrib] === null) {
          return done();
        }

        enhances[attrib].findById(model[attrib], {directObject: true}, function (error, submodel) {
          if (error) {
            return done(error);
          }

          model[attrib] = submodel;
          done();
        });
      };

      var attrib;
      for (attrib in enhances) {
        if (enhances.hasOwnProperty(attrib)) {
          findAttrib(attrib);
        }
      }
    });
  };

  return View;
};