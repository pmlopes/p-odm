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
  "type" : "object",
  "properties": {
    "name": {"type": "string"},
    "address": {"$ref": "Simple#Address"}
  }
});


Person.findMe = function () {
};

function findMe() {

}

Person.prototype.findMe = function () {
};

// Tell that we're embedding Address as address on the person model
Person.embeds('address', Address);
