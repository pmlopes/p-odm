var odm = require('./lib');

// connect to the DB
odm.connect('mongodb://127.0.0.1:27017/mt-test');

odm.schema.createSchema({
  "type": "object",
  "id": "http://test.me/objectid",
  "description": "MongoDB ObjectID",
  "properties": {
    "id": {"type": "string"},
    "_bsontype": {"type": "string"}
  }
}, null, "http://test.me/objectid");

odm.schema.createSchema({
  "type": "object",
  "id": "energy",
  "description": "Energy",
  "properties": {
    "energy": {"type": "number"},
    "delta": {"type": "number"},
    "min": {"type": "number"},
    "max": {"type": "number"},
    "lastCalculation": {"type": "date"},
    "lastActivity": {"type": "date"},
    "regenerationTime": {"type": "date"}
  }
}, null, "energy");

var User = odm.model('users', {
  "type" : "object",
  "properties": {
    "gamertag": {"type": "string"},
    "_id": {"$ref": "http://test.me/objectid"},
    "focus": {"$ref": "energy"}
  }
});

User.findAll(function (error, users) {
  if (error) {
    console.log('ERROR(S): ', error);
    process.exit(1);
  }

  users[0].save(function(error) {
    if (error) {
      console.log('ERROR(S): ', error);
      process.exit(1);
    }

    odm.disconnect();
  });
});