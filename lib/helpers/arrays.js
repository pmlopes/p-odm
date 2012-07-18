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
      throw new Error('Bad query');
    }

    var negate = false;

    if (search.hasOwnProperty('$ne')) {
      negate = true;
      search = search.$ne;

      if (search === undefined || search === null) {
        throw new Error('Bad query');
      }
    }

    var multi = false;

    if (search.hasOwnProperty('$in')) {
      multi = true;
      if (!Array.isArray(search.$in)) {
        throw new Error('$in/$nin expect an array');
      }
      search = search.$in;

      if (search === undefined || search === null) {
        throw new Error('Bad query');
      }
    }

    if (search.hasOwnProperty('$nin')) {
      multi = true;
      negate = true;
      if (!Array.isArray(search.$nin)) {
        throw new Error('$in/$nin expect an array');
      }
      search = search.$nin;

      if (search === undefined || search === null) {
        throw new Error('Bad query');
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
            return false;
          }
        } else {
          if (!matched) {
            return false;
          }
        }
      } else {
        if (!matchValue(search, obj[key], negate)) {
          return false;
        }
      }
    } else {
      return false;
    }
  }

  return true;
}

/**
 * Verify if the object matches the query
 * @param query
 * @param value
 */
function matchesSimple(query, value) {

  var search = query;
  var i;

  if (search === undefined || search === null) {
    throw new Error('Bad query');
  }

  var negate = false;

  if (query.hasOwnProperty('$ne')) {
    negate = true;
    search = query.$ne;

    if (search === undefined || search === null) {
      throw new Error('Bad query');
    }
  }

  var multi = false;

  if (search.hasOwnProperty('$in')) {
    multi = true;
    if (!Array.isArray(search.$in)) {
      throw new Error('$in/$nin expect an array');
    }
    search = search.$in;

    if (search === undefined || search === null) {
      throw new Error('Bad query');
    }
  }

  if (search.hasOwnProperty('$nin')) {
    multi = true;
    negate = true;
    if (!Array.isArray(search.$nin)) {
      throw new Error('$in/$nin expect an array');
    }
    search = search.$nin;

    if (search === undefined || search === null) {
      throw new Error('Bad query');
    }
  }

  if (multi) {
    var matched = false;
    for (i = 0; i < search.length; i++) {
      if (matchValue(search[i], value, false)) {
        matched = true;
        break;
      }
    }
    if (negate) {
      if (matched) {
        return false;
      }
    } else {
      if (!matched) {
        return false;
      }
    }
  } else {
    if (!matchValue(search, value, negate)) {
      return false;
    }
  }

  return true;
}

function indexOf(query, array) {

  var i;
  for (i = 0; i < array.length; i++) {
    if (matches(query, array[i])) {
      return i;
    }
  }

  return -1;
}

function findOne(query, array) {
  if (Array.isArray(array)) {
    var i;
    for (i = 0; i < array.length; i++) {
      if (matches(query, array[i])) {
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
      if (matches(query, array[i])) {
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
      if (matches(query, array[i])) {
        array.splice(i, 1);
        i--;
        removed++;
      }
    }
  }
  return removed;
}

function simpleIndexOf(val, array) {
  if (Array.isArray(array)) {
    if (val === undefined) {
      throw new Error('Bad query');
    }

    var i;
    for (i = 0; i < array.length; i++) {
      if (matchesSimple(val, array[i])) {
        return i;
      }
    }
  }
  return -1;
}

function simpleFindOne(val, array) {
  if (Array.isArray(array)) {
    if (val === undefined) {
      throw new Error('Bad query');
    }

    var i;
    for (i = 0; i < array.length; i++) {
      if (matchesSimple(val, array[i])) {
        return array[i];
      }
    }
  }
  return null;
}

function simpleFind(val, array) {
  if (Array.isArray(array)) {
    if (val === undefined) {
      throw new Error('Bad query');
    }

    var result = [];
    var i;
    for (i = 0; i < array.length; i++) {
      if (matchesSimple(val, array[i])) {
        result.push(array[i]);
      }
    }
  }
  return result;
}

function simpleRemove(val, array) {
  if (Array.isArray(array)) {
    if (val === undefined) {
      throw new Error('Bad query');
    }

    var i;
    var removed = 0;

    for (i = 0; i < array.length; i++) {
      if (matchesSimple(val, array[i])) {
        array.splice(i, 1);
        i--;
        removed++;
      }
    }
  }
  return removed;
}

module.exports = {
  indexOf: indexOf,
  findOne: findOne,
  findById: findById,
  find: find,
  remove: remove,

  simpleIndexOf: simpleIndexOf,
  simpleFindOne: simpleFindOne,
  simpleFind: simpleFind,
  simpleRemove: simpleRemove
};