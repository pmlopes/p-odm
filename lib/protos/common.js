'use strict';

/**
 * @private
 * Extracts one option from the object and returns it.
 * @param name
 * @param options
 * @param defaultValue
 * @return {*}
 */
function extractOption(name, options, defaultValue) {
  var option = defaultValue;
  if (options) {
    if (options.hasOwnProperty(name)) {
      option = options[name];
      delete options[name];
    }
  }
  return option;
}

/**
 * @private
 * Gets one option from the object and returns it.
 * @param name
 * @param options
 * @param defaultValue
 * @return {*}
 */
function getOption(name, options, defaultValue) {
  var option = defaultValue;
  if (options) {
    if (options.hasOwnProperty(name)) {
      option = options[name];
    }
  }
  return option;
}

/**
 * @private
 * allows to call a callback after n times with proper error handling.
 *
 * @param times
 * @param callback
 */
function after(times, callback) {

  // special case when times is zero call right away and exit
  if (times === 0) {
    return callback(null);
  }

  var calls = times;
  var gotError = false;

  return function (error) {
    if (error) {
      gotError = true;
      return callback(error);
    }

    if (!gotError && --calls === 0) {
      return callback(null);
    }
  };
}


module.exports = {
  extractOption: extractOption,
  getOption: getOption,
  after: after
};

