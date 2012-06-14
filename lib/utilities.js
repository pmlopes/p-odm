'use strict';

var mongodb = require('mongodb');
var ObjectID = mongodb.BSONPure.ObjectID;

function clone(obj) {

  if (obj !== undefined && obj !== null) {
    var isArray = Array.isArray(obj);

    var newObj;
    var i;
    var v;
    var totalUndefined = 0;
    var cloned;

    if (isArray) {
      if (obj.length === 0) {
        return undefined;
      }

      newObj = [];

      for (i = 0; i < obj.length; i++) {
        v = obj[i];
        if (v === undefined) {
          totalUndefined++;
          continue;
        }

        switch(typeof v) {
          case 'boolean':
          case 'number':
          case 'string':
            newObj[i] = v;
            continue;
          case 'function':
            continue;
          case 'object':
            if (v === null || v instanceof String || v instanceof Number || v instanceof Boolean || v instanceof Date || v instanceof ObjectID) {
              newObj[i] = v;
            } else {
              cloned = clone(v);
              if (cloned === undefined) {
                totalUndefined++;
              }
              newObj[i] = cloned;
            }
            continue;
          default:
            newObj[i] = v;
        }
      }

      if (totalUndefined === obj.length) {
        return undefined;
      }

    } else {
      var keys = Object.keys(obj);
      if (keys.length === 0) {
        return undefined;
      }

      newObj = {};

      var j;
      for (j = 0; j < keys.length; j++) {
        i = keys[j];
        v = obj[i];
        if (v === undefined) {
          totalUndefined++;
          continue;
        }

        switch(typeof v) {
          case 'boolean':
          case 'number':
          case 'string':
            newObj[i] = v;
            continue;
          case 'function':
            continue;
            break;
          case 'object':
            if (v === null || v instanceof String || v instanceof Number || v instanceof Boolean || v instanceof Date || v instanceof ObjectID) {
              newObj[i] = v;
            } else {
              cloned = clone(v);
              if (cloned === undefined) {
                totalUndefined++;
              }
              newObj[i] = cloned;
            }
            continue;
          default:
            newObj[i] = v;
        }
      }

      if (totalUndefined === keys.length) {
        return undefined;
      }
    }

    return newObj;
  }

  return obj;
}

module.exports = {
  clone : clone
};