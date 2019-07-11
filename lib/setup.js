
'use strict';

var fs   = require('fs')
,   _    = require('lodash')
,   path = require('path')
,   AWS  = require('aws-sdk');
AWS.config.update({maxRetries: 10, retryDelayOptions: {base: 300}});

const parse_tag = function(tags) {
  return _.map(tags, (tag) => {
    return _.transform(tag, (result, value, key) => {
      result.Key = key;
      result.Value = value;
    }, {});
  });
}

module.exports = function(opts) {
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

  if (!opts.rollback) {
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
  }

  sets.opts = _.pick(opts,[
    'region',
    'applicationName',
    'environmentName',
    'sourceBundle',
    'description'
  ]);

  sets.opts.versionLabel = opts.versionLabel || path.basename(opts.sourceBundle, path.extname(opts.sourceBundle));
  sets.bucketParam = {
    Bucket: (opts.s3Bucket && opts.s3Bucket.bucket) || opts.applicationName,
    Key: (opts.s3Bucket && opts.s3Bucket.key) || path.basename(opts.sourceBundle)
  };
  sets.opts.ResourceArn = `arn:aws:elasticbeanstalk:${opts.region}:${opts.account_id}:environment/${opts.applicationName}/${opts.environmentName}`;
  sets.opts.TagsToAdd = parse_tag(opts.tagsToAdd) || [];
  sets.opts.TagsToRemove = parse_tag(opts.tagsToRemove) || [];
  sets.eb = new AWS.ElasticBeanstalk({ region: opts.region });
  sets.envSettings = opts.settings;
  return sets;
};
