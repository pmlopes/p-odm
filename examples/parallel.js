'use strict';
var odm = require('../lib');

// connect to the DB
odm.connect('mongodb://127.0.0.1:27017/mt');


var MonsterType = odm.model('monstertypes');
var ElementType = odm.model('elementtypes');

odm.parallel({monsterTypes: MonsterType.prepareFindAll(), elementTypes: ElementType.prepareFindAll()}, function (error, resultSet) {
  if (error) {
    console.error(error);
    process.exit(1);
  }

  console.log(resultSet.monsterTypes.length);
  console.log(resultSet.elementTypes.length);
  process.exit(0);
});