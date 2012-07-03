# ODM

## Connect

	odm.connect('mongodb://127.0.0.1:27017/simple');

## Define a model

	// Person model
	var Person = odm.model("persons", {
	  name: String,
	  address: Address
	});

## Methods

### Model#findOne
### Model#findById
### Model#find
### Model#findAll
### Model#remove
### Model#update
### Model#embeds

### Model.save
### Model.update
### Model.insert
### Model.remove
