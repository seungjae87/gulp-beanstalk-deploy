
var setup  = require('./lib/setup')
,   aws    = require('./lib/aws')
,   upload = aws.upload
,   createApplicationVersion = aws.createApplicationVersion
,   updateEnvironment = aws.updateEnvironment
,   waitdeploy = aws.waitdeploy;

module.exports = function(opts, cb) {

  var sets = setup(opts);

  upload(sets)
  .then(function(){
    return createApplicationVersion(sets)
  })
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
  .then(function(result){
    cb(null, result);
  })
  .catch(function(error){
    cb(error);
  });

}
