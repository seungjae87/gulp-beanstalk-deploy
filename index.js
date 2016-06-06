
var fs     = require('fs')
 ,  path   = require('path')
 ,  Q      = require('q')
 ,  _      = require('lodash')
 ,  util   = require('gulp-util')
 ,  AWS    = require('aws-sdk')
 ,  color  = util.colors
,   logger = util.log;


function setup(opts) {
  var sets = {};
  if(opts.accessKeyId && opts.secretAccessKey) {
    AWS.config.credentials = new AWS.Credentials({
      accessKeyId: opts.accessKeyId,
      secretAccessKey: opts.secretAccessKey
    });
  }
  if(!opts.region) {
    throw new Error('Param missing [region]');
  }
  if(!opts.applicationName) {
    throw new Error('Param missing [applicationName]');
  }
  if(!opts.environmentName) {
    throw new Error('Param missing [environmentName]');
  }
  if(!opts.sourceBundle) {
    throw new Error('Param missing [sourceBundle]');
  }

  try {
    fs.statSync(opts.sourceBundle);
  } catch(e) {
    var error_msg;
    if(e.code === 'ENOENT' ) {
      error_msg = new Error('Invalid sourceBundle, It is not exist ' + opts.sourceBundle);
    } else {
      error_msg = e;
    }
    throw error_msg;
  }

  sets.opts = _.pick(opts,[
    'region',
    'applicationName',
    'environmentName',
    'sourceBundle'
  ]);

  sets.opts.versionLabel = opts.versionLabel || path.basename(opts.sourceBundle, path.extname(opts.sourceBundle));
  sets.bucketParam = {
    Bucket: (opts.s3Bucket && opts.s3Bucket.bucket) || opts.applicationName,
    Key: (opts.s3Bucket && opts.s3Bucket.key) || path.basename(opts.sourceBundle)
  };
  sets.eb = new AWS.ElasticBeanstalk({ region: opts.region });
  return sets;
}

function upload(sets) {
  var opts = sets.opts
  ,   bucketParam = sets.bucketParam
  ,   s3 = new AWS.S3()
  ,   deferred = Q.defer();

  logger('Start to upload sourceBundle to %s/%s',
      color.cyan(bucketParam.Bucket),
      color.cyan(bucketParam.Key));

  fs.readFile(opts.sourceBundle, function(err, data) {

    if(err) {
      deferred.reject(err);
      return;
    }

    s3.putObject({
      Bucket: bucketParam.Bucket,
      Key: bucketParam.Key,
      Body: new Buffer(data)
    }, function(err, result){

      if(err) {
        deferred.reject(err);
        return;
      }

      logger('Upload success -> %s/%s ',
        color.cyan(bucketParam.Bucket),
        color.cyan(bucketParam.Key));
      deferred.resolve(result);

    });
  });

  return deferred.promise;
}

function createApplicationVersion(sets) {
  var eb = sets.eb
  ,   opts = sets.opts
  ,   bucketParam = sets.bucketParam
  ,   deferred = Q.defer();

  logger('Start to create application version %s to %s',
    color.cyan(opts.applicationName),
    color.cyan(opts.versionLabel));

  eb.createApplicationVersion({
    ApplicationName: opts.applicationName,
    VersionLabel: opts.versionLabel,
    SourceBundle: {
      S3Bucket: bucketParam.Bucket,
      S3Key: bucketParam.Key
    }
  }, function(error, version){
    if(error) {
      logger('Fail to create application %s version to %s',
        color.red(opts.applicationName),
        color.red(opts.versionLabel));
      deferred.reject(error);
    } else {
      logger('Create application %s version to %s success',
        color.cyan(opts.applicationName),
        color.cyan(opts.versionLabel));
      deferred.resolve(version);
    }
  });
  return deferred.promise;
}

function updateEnvironment(sets, version) {
  var eb = sets.eb
  ,   opts = sets.opts
  ,   versionLabel = version.ApplicationVersion.VersionLabel
  ,   deferred = Q.defer();

  logger('Start to update enviroment version %s to %s',
    color.cyan(opts.environmentName),
    color.cyan(versionLabel));

  eb.updateEnvironment({
    EnvironmentName: opts.environmentName,
    VersionLabel: versionLabel
  }, function(error, result){
    if(error) {
      logger('Fail to update enviroment %s version to %s',
        color.red(opts.environmentName),
        color.red(versionLabel));
      deferred.reject(error);
    } else {
      logger('Deploying enviroment %s version to %s success',
        color.cyan(opts.environmentName),
        color.cyan(versionLabel));
      deferred.resolve(result);
    }
  });

  return deferred.promise;
}

function waitdeploy(sets, interval) {
  var eb = sets.eb
  ,   opts = sets.opts
  ,   waitState = sets.waitState = sets.waitState || {}
  ,   deferred = Q.defer();

  eb.describeEnvironmentHealth({
    EnvironmentName: opts.environmentName,
    AttributeNames: ['All']
  }, function(error, environment) {
    if(error) {
      return deferred.reject(error);
    }

    waitState.current = environment;
    waitState.current.color = color[environment.Color.toLowerCase()] || color.gray;

    if(waitState.prev) {
      var _p = waitState.prev.color;
      var _c = waitState.current.color;

      logger('Enviroment %s health has transitioned from %s(%s) to %s(%s)',
          color.cyan(opts.environmentName),
          _p(waitState.prev.HealthStatus),
          _p(waitState.prev.Status),
          _c(environment.HealthStatus),
          _c(environment.Status)
        );
    }

    waitState.prev = waitState.current;

    if(environment.Status === 'Ready') {
      deferred.resolve(environment);
      return;
    }

    deferred.resolve(Q.delay(interval).then(function(){
      waitdeploy(sets, interval);
    }));

  });

  return deferred.promise;

  // .then(function(enviroment){
  //   var env = _.omit(enviroment,[
  //     'ResponseMetadata',
  //     'InstancesHealth',
  //     'RefreshedAt'
  //   ]);
  //   var pc = color[sets.env.prev.Color.toLowerCase()] || color.gray;
  //   var nc = color[sets.enviroment.Color.toLowerCase()] || color.gray;
  //
  //   if(sets.env.prev && _.isEqual(sets.env.prev, enviroment)) {
  //     logger('Enviroment %s health has transitioned from %s(%s) to %s(%s)',
  //       color.cyan(env.name),
  //       pc(env.prev.HealthStatus),
  //       pc(env.prev.Status),
  //       pc(enviroment.HealthStatus),
  //       pc(enviroment.Status)
  //     );
  //   }
  //   env.prev = enviroment;
  //
  //   return (env.Status === 'Ready')? enviroment : Q.delay(inverval).then(function(){waitdeploy()});
  // });
}

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
