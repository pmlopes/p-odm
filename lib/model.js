'use strict';

/**
 * This module contains functions related to Object Document Mapping between JavaScript and MongoDB.
 *
 * @author <a href="mailto:plopes@roughcookie.com">Paulo Lopes</a>
 * @version 3.0
 */
var baseModel = require('./protos/freemodel');
var schemaModel = require('./protos/schemamodel');
/**
 * Creates a new Document Model class
 *
 * @memberOf ODM
 * @param {String} [mongoCollection] Collection name, if not present this is an embedded document
 * @param {Object} schemaDef Schema definition
 *
 * @return {Model}
 */
module.exports = function (mongoCollection, schemaDef) {

  if (schemaDef === undefined) {
    if (typeof mongoCollection !== 'string') {
      schemaDef = mongoCollection;
      mongoCollection = undefined;
    }
  }

  var odm = this;

  if (schemaDef !== undefined && schemaDef !== null) {
    return schemaModel(odm, schemaDef, mongoCollection);
  }

  if (mongoCollection !== undefined) {
    return baseModel(odm, mongoCollection);
  }

  throw new Error('Cannot instantiate model without schema and collection');
};
