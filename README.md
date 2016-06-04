gulp-beanstalk-deploy
=====

A module to make easy AWS beanstalk deployment

## Installation
`npm install gulp-beanstalk-deploy`

## Test
`npm test`

## Usage
```javascript
var gulp = require('gulp');
var eb = require('gulp-beanstalk-deploy');

gulp.task('deploy', function(cb) {
  accessKeyId: 'Your AWS accessKeyId', // optional
  secretAccessKey: 'Your AWS secretAccessKey', // optional
  region: 'Your region', // required
  applicationName:'Your application name',
  environmentName: 'Your application environment name',
  versionLabel: 'version',
  archive: {
    path: __dirname,
    name: 'archive.zip'
  },
  bucketConfig: {
    Bucket: 'S3 Bucket'
  }
}, cb);
```

## License
MIT
