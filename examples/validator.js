'use strict';

var schema = new (require('jsonschema').Environment)();
var mongodb = require('mongodb');
var ObjectId = mongodb.BSONPure.ObjectID;


schema.addSchema({
  "type": "object",
  "id": "MongoDb#ObjectId",
  "description": "MongoDB ObjectID",
  "properties": {
    "id": {"type": "string"},
    "_bsontype": {"type": "string"}
  }
}, "MongoDb#ObjectId");

var schemaInstance = schema.addSchema({
  "id": "MonsterTracker#BattleSession",
  "type": "object",
  "description": "BattleSession",
  "properties": {
    "_id": {"$ref": "MongoDb#ObjectId"},
    "seed": {"type": "number"},
    "battleType": {"type": "integer"},
    "battleResult": {"type": "integer"}
  }
});


var oid = new ObjectId();
var oid_client = oid.toHexString();
console.log(schema.validate({_id: oid_client}, schemaInstance));

