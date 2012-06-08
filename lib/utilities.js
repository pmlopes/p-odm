'use strict';

var mongodb = require('mongodb');
var ObjectID = mongodb.BSONPure.ObjectID;

function clone(obj) {

  if (obj !== undefined && obj !== null) {
    var isArray = Array.isArray(obj);

    var newObj = isArray ? [] : {};
    var i;
    var v;

    if (isArray) {
      for (i = 0; i < obj.length; i++) {
        v = obj[i];
        if (v === undefined) {
          continue;
        }

        switch(typeof v) {
          case 'boolean':
          case 'number':
          case 'string':
            newObj[i] = v;
            continue;
            break;
          case 'function':
            continue;
            break;
          case 'object':
            if (v === null || v instanceof String || v instanceof Number || v instanceof Boolean || v instanceof Date || v instanceof ObjectID) {
              newObj[i] = v;
            } else {
              newObj[i] = clone(v);
            }
            continue;
            break;
          default:
            newObj[i] = v;
        }
      }
    } else {
      for (i in obj) {
        if (obj.hasOwnProperty(i)) {
          v = obj[i];
          if (v === undefined) {
            continue;
          }

          switch(typeof v) {
            case 'boolean':
            case 'number':
            case 'string':
              newObj[i] = v;
              continue;
              break;
            case 'function':
              continue;
              break;
            case 'object':
              if (v === null || v instanceof String || v instanceof Number || v instanceof Boolean || v instanceof Date || v instanceof ObjectID) {
                newObj[i] = v;
              } else {
                newObj[i] = clone(v);
              }
              continue;
              break;
            default:
              newObj[i] = v;
          }
        }
      }
    }

    return newObj;
  }

  return obj;
}

module.exports = {
  clone : clone
};