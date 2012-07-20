odm = require("../lib")
odm.connect "mongodb://127.0.0.1:27017/simple"

Address = odm.model
  id: "Simple#Address"
  type: "object"
  properties:
    lines:
      type: "array"
      items:
        type: "string"
    zip:
      type: "string"
    city:
      type: "string"
    country:
      type: "string"

Person = odm.model "persons",
  type: "object"
  properties:
    name:
      type: "string"
    address:
      $ref: "Simple#Address"

Person.embeds "address", Address
p = new Person
  name: "Barack Obama"
  address:
    lines: [ "1600 Pennsylvania Avenue Northwest" ]
    zip: "DC 20500"
    city: "Washington"
    country: "USA"

p.save (error, id) ->
  if error
    console.log "error", error
    process.exit 1
  else
    console.log id