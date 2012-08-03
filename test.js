'use strict';

var odm = require('./lib');

// connect to the DB
odm.connect('mongodb://127.0.0.1:27017/mt-test');

//var baseModel = require('./lib/protos/freemodel');
//var User = baseModel(odm, 'users');
//
//User.findOne({}, function (error, user) {
//  if (error) {
//    console.error(error);
//    process.exit(1);
//  }
//
//  console.log(user);
//  console.log(user instanceof User);
//  console.log(user.save);
//  process.exit(0);
//});

var schemaModel = require('./lib/protos/schemamodel');

// Address, to be embedded on Person
var Address = schemaModel(odm, {
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
var Person = schemaModel(odm, 'persons', {
  type : 'object',
  properties: {
    name: {'type': 'string'},
    address: {"$ref": "Simple#Address"}
  }
});

// Tell that we're embedding Address as address on the person model
Person.embeds('address', Address);

Person.prototype.sayHello = function () {
  console.log('Hello ' + this.name);
};

//// Create a new person
//var p = new Person();
//p.name = "Barack Obama";
//p.address = new Address();
//p.address.lines = [ "1600 Pennsylvania Avenue Northwest" ];
//p.address.zip = "DC 20500";
//p.address.city = "Washington";
//p.address.country = "USA";
//
//p.save(function (error) {
//  if (error) {
//    console.error(error);
//    process.exit(1);
//  }
//  process.exit(0);
//});

Person.findOne({name: "Barack Obama"}, {extend: true}, function (error, person) {
  if (error) {
    console.error(error);
    process.exit(1);
  }

  person.sayHello();
});