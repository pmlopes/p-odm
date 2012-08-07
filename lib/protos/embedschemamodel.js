'use strict';

/**
 * This module contains functions related to Object Document Mapping between JavaScript and MongoDB.
 *
 * @author <a href="mailto:plopes@roughcookie.com">Paulo Lopes</a>
 * @version 2.0
 */

/**
 * Creates a new Document Model class
 *
 * @memberOf ODM
 * @param {ODM} odm ODM module
 * @param {Object} schemaDef Schema definition
 *
 * @return {Model}
 */
module.exports = function (odm, schemaDef) {

  /**
   * @name Model
   * @class Document Model Customized class for a mongodb document schema.
   * @param {Object} [json] if provided will update the current instance with the json properties
   */
  var Model = function (json) {
    if (this instanceof Model) {
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
        json.__proto__ = Model.prototype;
      }
      return json;
    }
  };

  /**
   * schema for embedded objects
   *
   * @memberOf Model
   */
  Object.defineProperty(Model, '$schema', {value: odm.createSchema(schemaDef)});

  /**
   * Keep track of embeds (it is similar to prototype)
   */
  Object.defineProperty(Model, '$embeds', {value: []});

  /**
   * Verifies if an Object is valid against the configured validator
   *
   * @param {Boolean} [verbose]
   * @return {Boolean|Object}
   */
  Model.prototype.validate = function (verbose) {
    var validation = odm.validate(this, Model.$schema);
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
   *
   * @return {Boolean}
   */
  Model.prototype.isValid = function () {
    return this.validate();
  };

  /**
   * Clones the Type prototype to this model class
   * @param path {String} Path to be updated
   * @param type {Object} Type prototype to be copied
   */
  Model.embeds = function (path, type) {
    Model.$embeds.push({path: path, type: type});
  };

  return Model;
};
