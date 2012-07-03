'use strict';

var odm = require('../lib');

// connect to the DB
odm.connect('mongodb://127.0.0.1:27017/simple');

var Address = odm.model({
  lines: [String],
  zip: String,
  city: String,
  country: String
});

var Person = odm.model("persons", {
  name: String,
  address: Address
});

Person.embeds('address', Address);

var p = new Person({
  "name": "John Doe",
  "address": {
    lines: [ "Some Address" ]
  }
});

p.save(function (error, id) {
  if (error) {
    console.log("error", error);
    process.exit(1);
  } else {
    console.log(id);
  }
});
