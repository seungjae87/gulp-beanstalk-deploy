
var setup  = require('./lib/setup')
,   aws    = require('./lib/aws')
,   upload = aws.upload
,   createApplicationVersion = aws.createApplicationVersion
,   startRollback = aws.startRollback
,   updateEnvironment = aws.updateEnvironment
,   updateTag = aws.updateTag
,   waitdeploy = aws.waitdeploy;

module.exports = function(opts, cb) {

  var sets = setup(opts);
  let initialTasks;


  if (opts.rollback && opts.versionLabel) {
    initialTasks = startRollback(sets);
  } else {
    initialTasks = upload(sets)
      .then(function(){
        return createApplicationVersion(sets)
      });
  }

  initialTasks
  .then(function(version) {
    return updateEnvironment(sets, version)
  })
  .then(function(result) {
    if(opts.waitForDeploy === undefined || opts.waitForDeploy === null) {
      opts.waitForDeploy = true;
    }
    if(opts.waitForDeploy) {
      return waitdeploy(sets, opts.checkIntervalSec || 2000)
    } else {
      return result;
    }
  })
  .then(function() {
    return updateTag(sets)
  })
  .then(function(result) {
    if(opts.waitForDeploy === undefined || opts.waitForDeploy === null) {
      opts.waitForDeploy = true;
    }
    if(opts.waitForDeploy) {
      return waitdeploy(sets, opts.checkIntervalSec || 2000)
    } else {
      return result;
    }
  })
  .then(function(result){
    cb(null, result);
  })
  .catch(function(error){
    cb(error);
  });

}
