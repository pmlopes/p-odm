odm = require("../lib")

odm.connect "mongodb://127.0.0.1:27017/simple"

Address = odm.model
  lines: [ String ]
  zip: String
  city: String
  country: String

Person = odm.model "persons",
  name: String
  address: Address

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