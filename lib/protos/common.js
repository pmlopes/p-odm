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

function iterateCursor(cursor, callback) {
  if (cursor.tailable) {
    callback('Tailable cursor cannot be converted to array');
  } else if (cursor.state !== Cursor.CLOSED) {

    cursor.each(function (err, item) {
      if (err !== null) {
        return callback(err, null);
      }

      callback(null, item);
    });
  } else {
    callback('Cursor is closed');
  }
}

module.exports = {
  extractOption: extractOption,
  getOption: getOption,
  iterateCursor: iterateCursor
};

