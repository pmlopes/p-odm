'use strict';

var odm = require('../lib');

// Address, to be embedded on Person
var Address = odm.embeddedModel({
  "id": "Simple#Address",
  "type" : "object",
  "properties": {
    "lines": {
      "type": "array",
      "items": {"type": "string"}
    },
    "zip": {"type": "string"},
    "city": {"type": "string"},
    "country": {"type": "string"}
  }
});

/**
 * @name Person
 * @augments {SchemaModel} */
var Person = module.exports = odm.schemaModel("persons", {
  "id": "Simple#Person",
  "type" : "object",
  "properties": {
    "name": {"type": "string"},
    "address": {"$ref": "Simple#Address"}
  }
});

odm.graph('schema.dot', [Address.$schema, Person.$schema], function (error) {
  if (error) {
    console.log(error);
    process.exit(1);
  }
  process.exit(0);
});