'use strict';

/**
 * Extracts one option from the object and returns it.
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
 * Gets one option from the object and returns it.
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

module.exports = {
  extractOption: extractOption,
  getOption: getOption
};

