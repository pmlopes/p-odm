var odm = require('./lib');

// connect to the DB
odm.connect('mongodb://127.0.0.1:27017/mt');

// embedded docs
var StageTypeMonster = odm.model({
  rank:               Number,
  neededForSilver:    Boolean,
  neededForGold:      Boolean,
  shownInBook:        Boolean
});

// these methods will be applied to all instances of embedded doc
StageTypeMonster.prototype.whatIsMyRank = function () {
  return 'My Rank is ' + this.rank;
};

var StageType = odm.model('stagetypes', {
  index:                Number,
  monsters:             [StageTypeMonster],
  // This field is used for the tutorial stages
  bossBackground:       String,
  enableTutorial:       Boolean,

  bossBattle: {
    monsterLevel:       Number,
    monsterSize:        Number
  },

  percentageOfSubBossHPKnockoff: [Number],
  requiredExperience:  Number
});

StageType.prototype.isEnableTutorial = function () {
  return this.enableTutorial === true;
};

// pretend we are working with embedded docs
StageType.prototype.bossBattle = {
  greet: function () {
    return 'Monster size is: ' + this.monsterSize + ' and level is ' + this.monsterLevel;
  }
};

//StageType.findOne({index: 0}, function (error, stageType) {
//  if (error) {
//    console.log(error);
//    process.exit(1);
//  }
//
//  stageType.index = 1000;
//
//  stageType.reload(function (error) {
//    if (error) {
//      console.log(error);
//      process.exit(1);
//    }
//
//    console.log(stageType.index);
//
//    stageType.index = '1000';
//
//    stageType.save(function (error) {
//      if (error) {
//        console.log(error);
//      }
//    });
//  });
//});
//
StageType.findAll(function (error, stageTypes) {
  if (error) {
    console.log(error);
    process.exit(1);
  }

  stageTypes[0].monsters[1].rank = 505;
  stageTypes[0].update({$setpath: 'monsters.1.rank'}, function (error) {
    if (error) {
      console.log(error);
      process.exit(1);
    }
  });
});