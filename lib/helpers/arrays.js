var mongodb = require('mongodb');
var ObjectID = mongodb.BSONPure.ObjectID;

var objectIdRegExp = /^[0-9a-fA-F]{24}$/;

function matchValue(search, value, reverse) {
  var hasEquals = search.equals !== undefined && search.equals !== null && typeof search.equals === 'function';

  if (hasEquals) {
    if (reverse) {
      if (search.equals(value)) {
        return false;
      }
    } else {
      if (!search.equals(value)) {
        return false;
      }
    }
  } else {
    if (reverse) {
      if (search === value) {
        return false;
      }
    } else {
      if (search !== value) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Verify if the object matches the query
 * @param query
 * @param obj
 */
function matches(query, obj) {
  var keys = Object.keys(query);
  var i, j;

  for (i = 0; i < keys.length; i++) {
    var key = keys[i];
    var search = query[key];

    if (search === undefined || search === null) {
      return -2;
    }

    var negate = false;

    if (search.hasOwnProperty('$ne')) {
      negate = true;
      search = search.$ne;

      if (search === undefined || search === null) {
        return -2;
      }
    }

    var multi = false;

    if (search.hasOwnProperty('$in')) {
      multi = true;
      if (!Array.isArray(search.$in)) {
        return -3;
      }
      search = search.$in;

      if (search === undefined || search === null) {
        return -2;
      }
    }

    if (search.hasOwnProperty('$nin')) {
      multi = true;
      negate = true;
      if (!Array.isArray(search.$nin)) {
        return -3;
      }
      search = search.$nin;

      if (search === undefined || search === null) {
        return -2;
      }
    }

    if (obj.hasOwnProperty(key)) {
      if (multi) {
        var matched = false;
        for (j = 0; j < search.length; j++) {
          if (matchValue(search[j], obj[key], false)) {
            matched = true;
            break;
          }
        }
        if (negate) {
          if (matched) {
            return 0;
          }
        } else {
          if (!matched) {
            return 0;
          }
        }
      } else {
        if (!matchValue(search, obj[key], negate)) {
          return 0;
        }
      }
    } else {
      return 0;
    }
  }

  return 1;
}

function indexOf(query, array) {

  var i;
  for (i = 0; i < array.length; i++) {
    var match = matches(query, array[i]);
    if (match === -2) {
      return -2;
    }
    if (match === -3) {
      return -3;
    }
    if (match === 1) {
      return i;
    }
  }

  return -1;
}

function findOne(query, array) {
  if (Array.isArray(array)) {
    var i;
    for (i = 0; i < array.length; i++) {
      var match = matches(query, array[i]);
      if (match === -2) {
        return -2;
      }
      if (match === -3) {
        return -3;
      }
      if (match === 1) {
        return array[i];
      }
    }
  }
  return null;
}

function findById(id, array) {
  if (Array.isArray(array)) {
    var _id;

    if (id instanceof ObjectID) {
      _id = id;
    } else {
      if (typeof id === 'string' && id.length === 24 && objectIdRegExp.test(id)) {
        _id = ObjectID.createFromHexString(id);
      } else {
        return -4;
      }
    }

    var i;

    for (i = 0; i < array.length; i++) {
      var el = array[i];
      if (el.hasOwnProperty('_id') && _id.equals(el._id)) {
        return array[i];
      }
    }
  }
  // not found
  return null;
}

function find(query, array) {
  if (Array.isArray(array)) {
    var result = [];
    var i;

    for (i = 0; i < array.length; i++) {
      var match = matches(query, array[i]);
      if (match === -2) {
        return -2;
      }
      if (match === -3) {
        return -3;
      }
      if (match === 1) {
          result.push(array[i]);
      }
    }
  }
  return result;
}

function remove(query, array) {
  if (Array.isArray(array)) {
    var removed = 0;
    var i;

    for (i = 0; i < array.length; i++) {
      var match = matches(query, array[i]);
      if (match === -2) {
        return -2;
      }
      if (match === -3) {
        return -3;
      }
      if (match === 1) {
        array.splice(i, 1);
        i--;
        removed++;
      }
    }
  }
  return removed;
}

// -2 Bad Query
// -3 $in/$nin expect an array
// -4 bad id
module.exports = {
  indexOf: indexOf,
  findOne: findOne,
  findById: findById,
  find: find,
  remove: remove
};