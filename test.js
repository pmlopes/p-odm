var odm = require('./lib');

// connect to the DB
odm.connect('mongodb://127.0.0.1:27017/odm');

// define an embedded doc
var Index = odm.model({
  toc: [String]
});

// define a second embedded doc
var Chapter = odm.model({
  title: String,
  body: String
});

// define method on the second embedded doc
Chapter.prototype.sayHello = function () {
  return 'Hello ' + this.title;
};

// define a collection that is stored in mongo under the collection name 'books'
var Book = odm.model('books', {
  title: String,
  index: Index,
  chapters: [Chapter]
});


// create a simple instance
var book = new Book({
  title: 'Book Title',
  index: {
    toc: ['1', '2', '3']
  },
  chapters: [
    {title: 'Chapter 1', body: 'content 1'},
    {title: 'Chapter 2', body: 'content 2'}
  ]
});

// array embedded docs are instantiated as odm objects if using get/set, using [] you cannot call method functions
console.log(book.chapters.get(0).sayHello());
// all embedded docs have a reference to its parent so we can so saves
console.log(book.chapters.get(0).$parent);

console.log(book.toString());

var chap2 = book.chapters.get(1);

// changing a reference, changes the parent
chap2.body = 'My new body for chapter 2';

console.log(book.toString());

// same with arrays
book.index.toc.splice(0, 1);

console.log(book.toString());

// we can do searches in arrays like in mongo
book.chapters.findOne({title: 'Chapter 1'}, function (e, c) {
  // modifications propagate to the parent object
  c.title = 'Super ' + c.title;
  console.log(book.toString());

  // we can also remove and they propagate
  book.chapters.remove({}, function (e) {
    console.log(book.toString());

    // we can save at any time by going to the toplevel parent (you need to know the object structure though...
    book.index.$parent.save(function (e) {
      book.reload(function (e) {
        console.log(e);
      });
    });
  });
});

// Output of running
/*
 Hello Chapter 1
 { title: [Getter/Setter],
 index: [Getter/Setter],
 chapters: [Getter/Setter],
 _id: [Getter] }
 {"title":"Book Title","index":{"toc":["1","2","3"]},"chapters":[{"title":"Chapter 1","body":"content 1"},{"title":"Chapter 2","body":"content 2"}]}
 {"title":"Book Title","index":{"toc":["1","2","3"]},"chapters":[{"title":"Chapter 1","body":"content 1"},{"title":"Chapter 2","body":"My new body for chapter 2"}]}
 {"title":"Book Title","index":{"toc":["2","3"]},"chapters":[{"title":"Chapter 1","body":"content 1"},{"title":"Chapter 2","body":"My new body for chapter 2"}]}
 {"title":"Book Title","index":{"toc":["2","3"]},"chapters":[{"title":"Super Chapter 1","body":"content 1"},{"title":"Chapter 2","body":"My new body for chapter 2"}]}
 {"title":"Book Title","index":{"toc":["2","3"]},"chapters":[]}
 null
*/

// What ends up in mongodb

/*
 MongoDB shell version: 2.0.0
 connecting to: odm
 > db.books.find();
 { "title" : "Book Title", "index" : { "toc" : [ "2", "3" ] }, "chapters" : [ ], "_id" : ObjectId("4f6897c612f89af300000001") }
 >
 */