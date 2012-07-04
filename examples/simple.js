'use strict';

var odm = require('../lib');

// connect to the DB
odm.connect('mongodb://127.0.0.1:27017/simple');

// Address, to be embedded on Person
var Address = odm.model({
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

// Person model
var Person = odm.model("persons", {
  "type" : "object",
  "properties": {
    "name": {"type": "string"},
    "address": {"$ref": "Simple#Address"}
  }
});

// Tell that we're embedding Address as address on the person model
Person.embeds('address', Address);

// Create a new person
var p = new Person({
  "name": "Barack Obama",
  "address": {
    "lines": [ "1600 Pennsylvania Avenue Northwest" ],
    "zip": "DC 20500",
    "city": "Washington",
    "country": "USA"
  }
});

// Save to the database
p.save(function (error, id) {
  if (error) {
    console.log("error", error);
    process.exit(1);
  } else {
    console.log(id);
  }
});
