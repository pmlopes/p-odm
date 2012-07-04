# ODM

ODM is a new, innovative and easy way to use MongoDB documents, as Models, in your code.
It uses the [JSON schema](http://tools.ietf.org/html/draft-zyp-json-schema-03) standard for validating the documents.

## Quick Start

### Connect

	odm.connect('mongodb://127.0.0.1:27017/simple');

### Define a model

	var Person = odm.model("persons", {
	  "type" : "object",
	  "properties": {
	    "name": {"type": "string"},
	  }
	});

### Embedding other documents

We embed an address model in person:
	
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
	
The changed person model:
	
	var Person = odm.model("persons", {
	  "type" : "object",
	  "properties": {
	    "name": {"type": "string"},
	    "address": {"$ref": "Simple#Address"}
	  }
	});


## Methods

### Class methods

#### ODM#parse(jsonString)
Parses a JSON string to a JSON document. It is aware of ISO Dates and ObjectIds and coverts them on the fly.

#### Model#findOne(query, fields, options, callback)
Finds one document or `fields`, satisfying `query`.

	Person.findOne({'name': 'Barack Obama'}, function (error, document) {
	  if (error) {
	    console.log("error", error);
	  }
	  console.log(document);
	});
#### Model#findById(id, fields, options, callback)
Finds one document by `id`, returining `fields`.

	Person.findById("4ff3fcf14335e9d6ba000001", function (error, document) {
	  if (error) {
	    console.log("error", error);
	  }
	  console.log(document);
	});
#### Model#find(query, fields, options, callback)
Finds all documents or `fields`, satisfying `query`.

	Person.find({'name': 'Barack Obama'}, function (error, documents) {
	  if (error) {
	    console.log("error", error);
	  }
	  console.log(documents);
	});
	
#### Model#findAll(fields, options, callback)
Finds all documents or `fields`.

	Person.findAll(function (error, documents) {
	  if (error) {
	    console.log("error", error);
	  }
	  console.log(documents);
	});

#### Model#remove(query, options, callback)
Removes all documents satisfying `query`.

#### Model#update(query, document, options, callback)
Update all documents satisfying `query`, with document.

#### Model#asModel(obj)
Utility function to convert a JSON object to a Model class without breaking any linked references (e.g.: a object in an array).

#### Model#ensureIndex(fieldOrSpec, options, callback)
Adds an index and will also add a `findByXXX` method, where XXX is the name of the `fieldOrSpec`

### Instance methods

#### Model.validate(verbose)
Returns true or false, or all errors in case `verbose` is true.

#### Model.save(options, callback)
Saves the instance model.

	p.save(function (error, id) {
	  if (error) {
	    console.log("error", error);
	  } 
	  console.log(id);
	});

#### Model.update(query, document, options, callback)
Update the instance model.

#### Model.insert(options, callback)
Insert the instance model.

#### Model.remove(options, callback)
Remove the instance model.