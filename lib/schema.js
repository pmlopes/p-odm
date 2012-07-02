var mongodb = require('mongodb');

var ObjectId = mongodb.BSONPure.ObjectID;
var Binary = mongodb.BSONPure.Binary;

var objectIdRegExp = /^[0-9a-fA-F]{24}$/;
var ISO8601RegExp = /^(\d{4})\D?(0[1-9]|1[0-2])\D?([12]\d|0[1-9]|3[01])(\D?([01]\d|2[0-3])\D?([0-5]\d)\D?([0-5]\d)?\D?(\d{3})?([zZ]|([\+\-])([01]\d|2[0-3])\D?([0-5]\d)?)?)?$/;

/**
 * @private
 */
function isSpecial(obj) {
  var key;
  for (key in obj) {
    if (obj.hasOwnProperty(key) && key === '$validate') {
      return true;
    }
  }
  return false;
}

function createValidator(baseType) {

  var typeName;
  var readableName;

  switch (baseType) {
    case String:
      typeName = 'string';
      break;
    case Number:
      typeName = 'number';
      break;
    case Boolean:
      typeName = 'boolean';
      break;
    case Date:
      typeName = 'object';
      readableName = 'Date';
      break;
    case ObjectId:
      typeName = 'object';
      readableName = 'ObjectId';
      break;
    case Binary:
      typeName = 'object';
      readableName = 'Binary';
      break;
    default:
      typeName = 'object';
      break;
  }

  return function (value, path) {
    if (value !== undefined && value !== null) {
      if (!((typeof (value) === typeName) || (value instanceof baseType))) {
        if (baseType === ObjectId) {
          // try to see if are receiving a string representation of an ObjectId
          if (typeof value  === 'string' && value.length === 24 && objectIdRegExp.test(value)) {
            return ObjectId.createFromHexString(value);
          }
        }
        if (baseType === Date) {
          // try to see if we are receiving an ISO string
          if (typeof value  === 'string' && ISO8601RegExp.test(value)) {
            return new Date(Date.parse(value));
          }
        }
        throw new Error(path + ' must have type: ' + (readableName === undefined ? typeName : readableName));
      }
    } else {
      if (this.$required) {
        throw new Error(path + ' is required');
      }
    }

    return value;
  };
}

/**
 * @private
 */
function objectArrayValidator(arraySchema, value, path) {
  var subKey;
  var dataKeys;
  var idx;
  var result;

  if (value !== undefined && value !== null && typeof value === 'object') {
    dataKeys = Object.keys(value);
  }

  for (subKey in arraySchema) {
    if (arraySchema.hasOwnProperty(subKey)) {
      if (arraySchema[subKey].$validate) {
        if (value !== undefined && value !== null) {
          if (typeof value === 'object') {
            result = arraySchema[subKey].$validate(value[subKey], path + '.' + subKey);
            if (result === undefined) {
              delete value[subKey];
            } else {
              value[subKey] = result;
            }
          } else {
            throw new Error('\'' + value + '\' expected to be an object in the document [' + path + ']');
          }
        } else {
          arraySchema[subKey].$validate(undefined, path + '.' + subKey);
        }
      } else {
        if (value !== undefined && value !== null) {
          if (typeof value === 'object') {
            result = objectArrayValidator(arraySchema[subKey], value[subKey], path + '.' + subKey);
            if (result === undefined) {
              delete value[subKey];
            } else {
              value[subKey] = result;
            }
          } else {
            throw new Error('\'' + value + '\' expected to be an object in the document [' + path + ']');
          }
        } else {
          objectArrayValidator(arraySchema[subKey], undefined, path + '.' + subKey);
        }
      }

      if (dataKeys !== undefined) {
        idx = dataKeys.indexOf(subKey);
        if (idx !== -1) {
          dataKeys.splice(idx, 1);
        }
      }
    }
  }

  if (dataKeys !== undefined && dataKeys.length !== 0) {
    for (idx = 0; idx < dataKeys.length; idx++) {
      console.error(dataKeys[idx] + ' is not defined in the document [' + path + ']');
    }
  }

  return value;
}


/**
 * @private
 */
function compileSchema(schema, prototype) {

  var buildInternalValue = function (key, type) {

    if (type === undefined || type === null) {
      throw new Error('Incomplete schema: ' + key + ' is undefined');
    }

    var internalValue = {};

    if (Array.isArray(type)) {
      var arrayInternalValue = buildInternalValue(key, type[0]);

      internalValue.$validate = function (value, path) {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            var i;
            if (arrayInternalValue.$validate !== undefined) {
              // simple types
              for (i = 0; i < value.length; i++) {
                value[i] = arrayInternalValue.$validate(value[i], path + '.' + i);
              }
            } else {
              // embedded doc types
              for (i = 0; i < value.length; i++) {
                value[i] = objectArrayValidator(arrayInternalValue, value[i], path + '.' + i);
              }
            }
          } else {
            throw new Error(key + ' must be an Array');
          }
        } else {
          if (this.$required) {
            throw new Error(path + ' is required');
          }
        }
        return value;
      };
    } else if (type === String || type === Number || type === Boolean || type === Date || type === ObjectId || type === Binary || type === Object) {
      internalValue.$validate = createValidator(type);
    } else if (typeof (type) === 'function') {
      // this is a declared embedded document
      if (type.$schema !== undefined) {
        var protokey;
        for (protokey in type.prototype) {
          if (protokey !== 'save' && protokey !== 'update' && protokey !== 'remove' && protokey !== 'reload') {
            if (type.prototype.hasOwnProperty(protokey)) {
              if (!prototype.hasOwnProperty(key)) {
                prototype[key] = {};
              }
              prototype[key][protokey] = type.prototype[protokey];
            }
          }
        }
        internalValue = type.$schema;
      } else {
        throw new Error('type of ' + key + ' is not supported, don\'t know how to implement a schema parser for it');
      }
    } else if (isSpecial(type)) {
      internalValue.$validate = (type.$validate !== undefined) ? (type.$validate) : internalValue.$validate;
    } else {
      if (type.$schema === undefined) {
        // inline docs cannot have prototype
        internalValue = compileSchema(type, undefined);
        type.$schema = internalValue;
      } else {
        internalValue = type.$schema;
      }
    }
    return internalValue;
  };

  var internalSchema = {};
  var key;
  for (key in schema) {
    if (schema.hasOwnProperty(key)) {
      internalSchema[key] = buildInternalValue(key, schema[key]);
    }
  }
  return internalSchema;
}

/**
 * Validate the model object with the data either from db or from user
 */
function validate(schema, data, path) {
  var key;
  var dataKeys;
  var idx;
  var result;

  if (data !== undefined && data !== null && typeof data === 'object') {
    dataKeys = Object.keys(data);
  }

  for (key in schema) {
    if (schema.hasOwnProperty(key)) {
      if (typeof schema[key].$validate === 'function') {
        // this is a leaf (contains data)
        if (data !== undefined && data !== null) {
          result = schema[key].$validate(data[key], path + '.' + key);
          if (result === undefined) {
            delete data[key];
          } else {
            data[key] = result;
          }
        } else {
          schema[key].$validate(undefined, path + '.' + key);
        }
      } else {
        // this is a branch (embedded document)
        if (data !== undefined && data !== null) {
          if (typeof data === 'object') {
            validate(schema[key], data[key], path + '.' + key);
          } else {
            console.error('\'' + data + '\' expected to be an object in the document [' + path + ']');
          }
        } else {
          validate(schema[key], undefined, path + '.' + key);
        }
      }
      if (dataKeys !== undefined) {
        idx = dataKeys.indexOf(key);
        if (idx !== -1) {
          dataKeys.splice(idx, 1);
        }
      }
    }
  }
  if (dataKeys !== undefined) {
    // skip _id, they have a semantic meaning
    idx = dataKeys.indexOf('_id');
    if (idx !== -1) {
      dataKeys.splice(idx, 1);
    }
    if (dataKeys.length !== 0) {
      for (idx = 0; idx < dataKeys.length; idx++) {
        console.error(dataKeys[idx] + ' is not defined in the document [' + path + ']');
      }
    }
  }
}

module.exports = {
  compile: compileSchema,
  validate: validate
};