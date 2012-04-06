# ODM Documentation

## Defining models

  `var YourModelClass = odm.model(...)`

model function arguments are:

  * mongoCollection - The name of the collection on MongoDB.
  * l2cache - allow the odm to cache findById and findAll 256 queries for 30s if no changes using a LRU cache.
  * schema - schema definition of the model.

If mongoCollection is not defined this is a embedded model (meaning that is a model that can be part of other models).

l2Cache can only be defined if mongoCollection is defined and is optional.

Schema must always be present.

### Schemas

Schemas are plain JavaScript Objects describing the fields of the model. The formal is:

  `{fieldName: Type}`

Field names must adhere to MongoDB naming convention, therefore names starting with $ are not allowed. any other name is
allowed.

### Types

Recognized types are:

  * String
  * Number
  * Boolean
  * Date
  * ObjectId
  * Binary
  * Model Objects
  * [] (Arrays)
  * {$set: Function} (Specials)

ObjectId and Binary are mongoDB specific you can get the Object type from the odm module exports.

Arrays can take any of supported types, for example an Array of Strings would be defined as [String].

Specials are for cases you need to control what gets stored on MongoDB, in this case you need to pass a function that
validates the values. This function has the following signature:

  `function (value): value`

## Model methods

Every model has a set of common methods, some at class level and some at intance level. The methods at class level are:

  * findOne(query, options, callback)
  * findById(id, options, callback)
  * find(query, fields, options, callback)
  * findAll(fields, options, callback)
  * loadDbRef(ids, fields, options, callback)
  * ensureIndex(fieldOrSpec, options, callback)
  * remove(query, options, callback)

Instance level methods:

  * toJSON()
  * toString()
  * save(options, callback)
  * remove(options, callback)

Fields and options are always optional. Callbacks have always the following format:

  `function(error, result): void`

Embedded documents also have the same method definition with the exception that if you try to save, update or delete you
will get an error since it is not allowed to save the embedded document (because only its parent is stored).

### loadDbRef

loadDbRef is an extension to the mongodb API, it allows to quickly load a Id or array of Ids, the functionality is that
the response array will have the same length as the ids array and the result will be in the same order. Because of this
the complexity of this call is O(2n), the bigger the array the longer it will take.

## Arrays

Internal arrays of Objects mock the behavior of mongoDB, in other words internal arrays have the following methods:

  * find(query, options, callback)
  * findById(id, options, callback)
  * findOne(query, options, callback)
  * remove(query, callback)

Mofifying a array element modified the underlying document. On top of this the arrays have 3 extra helper methods:

  * push(element...)
  * get(index)
  * set(index, value)

Using these 3 methods will make sure the objects being returned are instantiated as defined in the schema. If you decide
to use indexes e.g.: array[i] then you will only get the json object due to limitation of javascript now allowing me
to overwrite the indexing function.

Since array finders are simplified versions of the mongo finder, you can only search for equality, not equality and
in/not in array.

  * equality: `{field: value_to_match}`
  * inequality: `{field: {$ne: value_not_to_match}}`
  * in array: `{field: $in: [element1, element2]}}`
  * not in array: `{field: $nin: [element1, element2]}}`

Since arrays are plain extensions of JavaScript arrays you have all the other array functions available such as splice,
some, etc....

## Embedded Documents

Embedded Documents behave just like other documents but have one extra property:

  `$parent`

This property allows an embedded document to reference its parent document, it is only set if a document is created from
an ODM call, if you create a embedded document object with `new` the property will not be available (unless you create
the full top level object).

## Properties and empty Objects

Models and embedded documents can be checked if they contain a specific property using the same signature as the Object
object.

  `model.hasOwnPropery(property_name)` returns True if the property_name is present

If the Object has any properties can be checked with:

  `model.isEmpty()`

# Convenience

undefined Arrays and Object properties are always initialized to []|{} on get