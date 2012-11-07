/**
 * This module contains functions related to Object Document Mapping between JavaScript and MongoDB.
 *
 * @author <a href="mailto:plopes@roughcookie.com">Paulo Lopes</a>
 */
'use strict';

/**
 * @private
 * @readonly
 * @const
 *
 * @type {String}
 */
var PROTO = '__proto__';

/**
 * Creates a new Document EmbeddedSchemaModel class
 *
 * @param {ODM} odm ODM module
 * @param {Object} schemaDef Schema definition
 *
 * @return {Function}
 */
function embeddedSchemaModelClassGenerator(odm, schemaDef) {

  /**
   * Document EmbeddedSchemaModel Customized class for a mongodb document schema.
   * @global
   * @name EmbeddedSchemaModel
   * @constructor
   * @param {Object} [json] if provided will update the current instance with the json properties
   */
  var EmbeddedSchemaModel = function (json) {
    if (json !== undefined && json !== null) {
      var key;
      for (key in json) {
        if (json.hasOwnProperty(key)) {
          this[key] = json[key];
        }
      }
    }
  };

  /**
   * schema for embedded objects
   * @memberOf EmbeddedSchemaModel
   */
  Object.defineProperty(EmbeddedSchemaModel, '$schema', {value: odm.createSchema(schemaDef)});

  /**
   * Verifies if an Object is valid against the configured validator
   * @memberOf EmbeddedSchemaModel.prototype
   * @param {Boolean} [verbose]
   * @return {Boolean|Object}
   */
  EmbeddedSchemaModel.prototype.validate = function (verbose) {
    var validation = odm.validate(this, EmbeddedSchemaModel.$schema);
    if (Array.isArray(validation)) {
      if (validation.length > 0) {
        if (verbose === true) {
          return validation;
        } else {
          return false;
        }
      }
    }

    // if no schema, always OK
    if (verbose === true) {
      return null;
    } else {
      return true;
    }
  };

  /**
   * Helper to have a short syntax
   * @memberOf EmbeddedSchemaModel.prototype
   * @return {Boolean}
   */
  EmbeddedSchemaModel.prototype.isValid = function () {
    return this.validate();
  };

  /**
   * Casts a Object to this model class.
   *
   * @static
   * @memberOf EmbeddedSchemaModel
   * @param {Object} obj Object to cast
   * @return {EmbeddedSchemaModel} the same object but casted
   */
  EmbeddedSchemaModel.cast = function (obj) {
    if (obj !== undefined && obj !== null && typeof obj === 'object') {
      obj[PROTO] = EmbeddedSchemaModel.prototype;
    }
    return obj;
  };

  return EmbeddedSchemaModel;
}

module.exports = embeddedSchemaModelClassGenerator;