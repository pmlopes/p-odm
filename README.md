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

    Person.embeds('address', Address);
	

## Methods

### ODM#parse

### Model#findOne(query, fields, options, callback)
Finds one document or `fields`, satisfying `query`.

### Model#findById(id, fields, options, callback)
Finds one document by `id`, returining `fields`.

### Model#find(query, fields, options, callback)
Finds all documents or `fields`, satisfying `query`.

### Model#findAll(fields, options, callback)
Finds all documents or `fields`.

### Model#remove(query, options, callback)
Removes all documents satisfying `query`.

### Model#update(query, document, options, callback)
### Model#embeds(path, type)
### Model#ensureIndex

### Model.validate(verbose)
### Model.save(options, callback)
### Model.update(query, document, options, callback)
### Model.insert(options, callback)
### Model.remove(options, callback)
