'use strict';

var mongodb = require('mongodb');
var ObjectID = mongodb.BSONPure.ObjectID;

var objectIdRegExp = /^[0-9a-fA-F]{24}$/;

/**
 * @private
 *
 * @param search
 * @param value
 * @param reverse
 * @return {Boolean}
 */
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
 * @private
 * Verify if the object matches the query
 * @param query
 * @param obj
 */
function matches(query, obj) {
  var keys = Object.keys(query);
  var i, j, lenI, lenJ;

  for (i = 0, lenI = keys.length; i < lenI; i++) {
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
        for (j = 0, lenJ = search.length; j < lenJ; j++) {
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
 * @private
 * Verify if the object matches the query
 * @param query
 * @param value
 */
function matchesSimple(query, value) {

  var search = query;
  var i, lenI;

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
    for (i = 0, lenI = search.length; i < lenI; i++) {
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

/**
 * @name ArrayHelper
 * @static
 * @class
 */
var ArrayHelper = {
  /**
   * @static
   * @memberOf ArrayHelper
   *
   * @param {Object} query
   * @param {Array} array
   * @return {Number}
   */
  indexOf: function (query, array) {
    if (Array.isArray(array)) {
      var i, lenI;
      for (i = 0, lenI = array.length; i < lenI; i++) {
        if (matches(query, array[i])) {
          return i;
        }
      }
    }
    return -1;
  },

  /**
   * @param {Object} query
   * @param {Array} array
   * @return {*}
   */
  findOne: function (query, array) {
    if (Array.isArray(array)) {
      var i, lenI;
      for (i = 0, lenI = array.length; i < lenI; i++) {
        if (matches(query, array[i])) {
          return array[i];
        }
      }
    }
    return null;
  },

  /**
   * @param {ObjectID|String} id
   * @param {Array} array
   * @return {*}
   */
  findById: function (id, array) {
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

      var i, lenI;

      for (i = 0, lenI = array.length; i < lenI; i++) {
        var el = array[i];
        if (el.hasOwnProperty('_id') && _id.equals(el._id)) {
          return array[i];
        }
      }
    }
    // not found
    return null;
  },

  /**
   * @param {Object} query
   * @param {Array} array
   * @return {Array}
   */
  find: function (query, array) {
    if (Array.isArray(array)) {
      var result = [];
      var i, lenI;

      for (i = 0, lenI = array.length; i < lenI; i++) {
        if (matches(query, array[i])) {
          result.push(array[i]);
        }
      }
    }
    return result;
  },

  /**
   * @param {Object} query
   * @param {Array} array
   * @return {Number}
   */
  remove: function (query, array) {
    if (Array.isArray(array)) {
      var removed = 0;
      var i, lenI;

      for (i = 0, lenI = array.length; i < lenI; i++) {
        if (matches(query, array[i])) {
          array.splice(i, 1);
          i--;
          lenI--;
          removed++;
        }
      }
    }
    return removed;
  },

  /**
   * @param {*} val
   * @param {Array} array
   * @return {Number}
   */
  simpleIndexOf: function (val, array) {
    if (Array.isArray(array)) {
      if (val === undefined) {
        throw new Error('Bad query');
      }

      var i, lenI;
      for (i = 0, lenI = array.length; i < lenI; i++) {
        if (matchesSimple(val, array[i])) {
          return i;
        }
      }
    }
    return -1;
  },

  /**
   * @param {*} val
   * @param {Array} array
   * @return {*}
   */
  simpleFindOne: function (val, array) {
    if (Array.isArray(array)) {
      if (val === undefined) {
        throw new Error('Bad query');
      }

      var i, lenI;
      for (i = 0, lenI = array.length; i < lenI; i++) {
        if (matchesSimple(val, array[i])) {
          return array[i];
        }
      }
    }
    return null;
  },

  /**
   * @param {*} val
   * @param {Array} array
   * @return {Array}
   */
  simpleFind: function (val, array) {
    if (Array.isArray(array)) {
      if (val === undefined) {
        throw new Error('Bad query');
      }

      var result = [];
      var i, lenI;
      for (i = 0, lenI = array.length; i < lenI; i++) {
        if (matchesSimple(val, array[i])) {
          result.push(array[i]);
        }
      }
    }
    return result;
  },

  /**
   * @param {*} val
   * @param {Array} array
   * @return {Number}
   */
  simpleRemove: function (val, array) {
    if (Array.isArray(array)) {
      if (val === undefined) {
        throw new Error('Bad query');
      }

      var i, lenI;
      var removed = 0;

      for (i = 0, lenI = array.length; i < lenI; i++) {
        if (matchesSimple(val, array[i])) {
          array.splice(i, 1);
          i--;
          lenI--;
          removed++;
        }
      }
    }
    return removed;
  }
};

module.exports = ArrayHelper;