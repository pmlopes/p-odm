'use strict';

var odm = require('../lib');

// connect to the DB
odm.connect('mongodb://127.0.0.1:27017/simple');

/** @type {Person} */
var Person = require('./Person');

Person.findOne({name: 'me'}, function (error, person) {
  if (error) {
    console.error(error);
  }

  person.findMe();
});

Person.findMe();

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
