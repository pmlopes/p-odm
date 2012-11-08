'use strict';
var odm = require('../lib');

// connect to the DB
odm.connect('mongodb://127.0.0.1:27017/mt');

var MonsterType = odm.model('monstertypes');
var ElementType = odm.model('elementtypes');

var MonsterTypeView = odm.view(MonsterType, {
  elementType: ElementType
});

function handleError(error) {
  if (error) {
    console.log("error", error);
    process.exit(1);
  }
}

MonsterTypeView.findOne({'name.EN': 'Abominus'}, function (error, monsterTypeView) {
  handleError(error);

  console.log(monsterTypeView);
  process.exit(0);
});
