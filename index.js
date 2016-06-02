var fs      = require('fs')
 ,  path    = require('path')
 ,  Promise = require('bluebird')
 ,  through = require('through2').obj
 ,  plexer  = require('plexer')
 ,  _       = require('lodash')
 ,  gutil   = require('gulp-util')
 ,  zip     = require('gulp-zip')
 ,  AWS     = require('aws-sdk')

var logTransition = function(envName, prevStatus, status) {
    var _color = {
        'Green': gutil.colors.green,
        'Yellow': gutil.colors.yellow,
        'Red': gutil.colors.red,
        'Grey': gutil.colors.gray
    }

    var colorPrev = _color[prevStatus.Color] || gutil.colors.grey
    var colorNew  = _color[status.Color] || gutil.colors.grey
    gutil.log('Enviroment %s transitioned from %s(%s) to %s(%s)',
        gutil.colors.cyan(envName),
        colorPrev(prevStatus.HealthStatus),
        colorPrev(prevStatus.Status),
        colorNew(status.HealthStatus),
        colorNew(status.Status)
    )
}

var prevEnv = null
var wait4deploy = function(bean, envName) {

    return bean.describeEnvironmentHealthAsync({
        EnvironmentName: envName,
        AttributeNames: [ 'All' ]
    })
    .then(function(env) {
        var _env = _.omit(env, [ 'ResponseMetadata', 'InstancesHealth', 'RefreshedAt' ])
        if (prevEnv != null && !_.isEqual(prevEnv, _env))
            logTransition(envName, prevEnv, _env)

        prevEnv = _env

        if (_env.Status == 'Ready')
            return env

        return Promise.delay(2000)
        .then(() => (wait4deploy(bean, envName)))
    })
}

 module.exports = function(opts, cb) {

    AWS.config.credentials = new AWS.Credentials({
        accessKeyId: opts.accessKeyId,
        secretAccessKey: opts.secretAccessKey
    })

    var bean = new AWS.ElasticBeanstalk({
        region: opts.region
    })
    var bucket = new AWS.S3({
        params: {
            Bucket: opts.bucketConfig.Bucket,
            Key: path.join(opts.applicationName, opts.archive.name)
        }
    });

    Promise.promisifyAll(bean)
    Promise.promisifyAll(bucket)

    var target = (opts.archive.path+'/'+opts.archive.name);

    fs.readFile(target, function(err, data) {
      if(err) {
        cb(err);
      } else {
        bucket.createBucketAsync()
        .catch(function(err) {
          if (err.code != 'BucketAlreadyOwnedByYou')
            throw err
        })
        .then(function() {
          gutil.log('Start to Upload souceBundle to %s/%s',
              gutil.colors.cyan(opts.bucketConfig.Bucket),
              gutil.colors.cyan(opts.applicationName+'/'+opts.archive.name)
          )
          var upload = bucket.upload({ Body: new Buffer(data) })
          var send = Promise.promisify(upload.send, { context: upload })
          return send()
        })
        .then(function() {
            return bean.createApplicationVersionAsync({
                ApplicationName: opts.applicationName,
                VersionLabel: opts.versionLabel,
                SourceBundle: {
                    S3Bucket: bucket.config.params.Bucket,
                    S3Key: bucket.config.params.Key
                }
            })
        })
        .then(function(appVersion) {
            return bean.updateEnvironmentAsync({
                EnvironmentName: opts.environmentName,
                VersionLabel: appVersion.ApplicationVersion.VersionLabel
            })
        })
        .then(function(envInfo) {
            gutil.log('Deploying version %s on environment %s',
                gutil.colors.cyan(envInfo.VersionLabel),
                gutil.colors.cyan(opts.environmentName)
            )

            if (opts.waitForDeploy !== false)
                return wait4deploy(bean, opts.environmentName)
            else
                return envInfo
        })
        .then(function() { cb(null, file) })
        .catch(cb)
      }
    });
}
