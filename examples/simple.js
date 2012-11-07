'use strict';

var odm = require('../lib');

// connect to the DB
odm.connect('mongodb://127.0.0.1:27017/simple');

/** @type {Person} */
var Person = require('./Person');

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

function handleError(error) {
  if (error) {
    console.log("error", error);
    process.exit(1);
  }
}

// Save to the database
p.save(function (error, oid) {
  handleError(error);

  p.snapshot(function (error) {
    handleError(error);

    p.update({$set: {name: 'Paulo Lopes'}}, function (error) {
      handleError(error);

      p.reload(function (error) {
        handleError(error);

        // should have name Paulo
        console.log(p);

        p.revert(function (error) {
          handleError(error);

          // should have name
          console.log(p);
          process.exit(0);
        });
      });
    });
  });
});
