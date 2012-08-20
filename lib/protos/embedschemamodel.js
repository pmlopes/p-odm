/**
 * This module contains functions related to Object Document Mapping between JavaScript and MongoDB.
 *
 * @author <a href="mailto:plopes@roughcookie.com">Paulo Lopes</a>
 */
'use strict';

/**
 * @private
 * @readonly
 *
 * @type {String}
 */
var PROTO = '__proto__';

/**
 * Creates a new Document EmbeddedModel class
 *
 * @param {ODM} odm ODM module
 * @param {Object} schemaDef Schema definition
 *
 * @return {Function}
 */
function schemalessclassGenerator(odm, schemaDef) {

  /**
   * Document EmbeddedModel Customized class for a mongodb document schema.
   * @global
   * @name EmbeddedModel
   * @constructor
   * @param {Object} [json] if provided will update the current instance with the json properties
   */
  var EmbeddedModel = function (json) {
    if (this !== undefined && this instanceof EmbeddedModel) {
      // new instance
      if (json !== undefined && json !== null) {
        var key;
        for (key in json) {
          if (json.hasOwnProperty(key)) {
            this[key] = json[key];
          }
        }
      }
    } else {
      // cast
      if (json !== undefined && json !== null) {
        json[PROTO] = EmbeddedModel.prototype;
      }
      return json;
    }
  };

  /**
   * schema for embedded objects
   * @memberOf EmbeddedModel
   */
  Object.defineProperty(EmbeddedModel, '$schema', {value: odm.createSchema(schemaDef)});

  /**
   * Keep track of embeds (it is similar to prototype)
   */
  Object.defineProperty(EmbeddedModel, '$embeds', {value: {}});

  /**
   * Verifies if an Object is valid against the configured validator
   * @memberOf EmbeddedModel.prototype
   * @param {Boolean} [verbose]
   * @return {Boolean|Object}
   */
  EmbeddedModel.prototype.validate = function (verbose) {
    var validation = odm.validate(this, EmbeddedModel.$schema);
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
   * @memberOf EmbeddedModel.prototype
   * @return {Boolean}
   */
  EmbeddedModel.prototype.isValid = function () {
    return this.validate();
  };

  /**
   * Clones the Type prototype to this model class
   * @deprecated
   * @static
   * @memberOf EmbeddedModel
   * @param path {String} Path to be updated
   * @param type {Object} Type prototype to be copied
   */
  EmbeddedModel.embeds = function (path, type) {
    EmbeddedModel.$embeds[path] = type;
  };

  return EmbeddedModel;
}

module.exports = schemalessclassGenerator;