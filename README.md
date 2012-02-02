ODM.js - Object Document mongodb library for node.js
=================================================

What is ODM.js?
------------------

`ODM.js` is a minimalistic wrapper around the excelent `node-mongodb-native` driver. It's easy to use and pretty small. ODM's design is centered on:

1. Simplicity
2. Proper Error Handling and Recovery using callbacks
3. Use of common idioms

License
-------

ODM is distributed under a MIT license. See the LICENSE file for more information.

Installation
============

`ODM.js` can be easily installed through NPM:

    npm install odm

Usage
=====

    var ODM = require('ODM')

Sample Application/Quick Guide
==============================

### Hello World
    
    var User = ODM.model('users', {name: String, Birthday: Date});
    User.findAll(function(err, users) {
      for(var i=0; i<users.length; i++) {
        console.log(users[i]);
      }
    });
    
This is arguably the simplest working program you can write using `ODM.js`.

The code above fetches all the documents from the collection named `users`, and prints their contents (Name and Birthday).

API
---

This section provides a quick overview of the ODM API. For detailed descriptons of the different commands mongodb provides, please check their documentation.

### ODM Module

*   **ODM.connect(connection_string)** - Configures the lazy connector to know where to connect

### Model

`Model` objects can be obtained through the `ODM#model` method:

#### Static methods

*   **new Model([data[, options]])** - Create a new model instance
*   **Model#find(query, callback)** - Find documents and wrap them in models
*   **Model#findAll(callback)** - Find documents and wrap them in models
*   **Model#findOne(query, callback)** - Find the first document and wrap it in a model
*   **Model#findById(query, callback)** - Find the first document and wrap it in a model

#### Instance methods

*   **Model#save()** - Persist the model back into the database
*   **Model#remove()** - Delete the object from the database
*   **Model#toJSON()** - Serialize a model to a JSON object
