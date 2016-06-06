
'use strict';

var setup = require('../lib/setup')
,   _ = require('lodash')
,   expect = require('chai').expect;

describe('Initial option validation check', function() {
  var opts = {
    region: 'us-west-1',
    applicationName: 'test-app',
    environmentName: 'test-env',
    sourceBundle: 'test.zip'
  }

  it('Should return error param missing `region`', function() {
    try {
      expect(setup(_.omit(opts,['region']))).to.be.empty;
    } catch(e) {
      expect(e.toString()).to.contain('Param missing [region]');
    }
  });

  it('Should return error param missing `applicationName`', function() {
    try {
      expect(setup(_.omit(opts,['applicationName']))).to.be.empty;
    } catch(e) {
      expect(e.toString()).to.contain('Param missing [applicationName]');
    }
  });

  it('Should return error param missing `environmentName`', function() {
    try {
      expect(setup(_.omit(opts,['environmentName']))).to.be.empty;
    } catch(e) {
      expect(e.toString()).to.contain('Param missing [environmentName]');
    }
  });

  it('Should return error param missing `sourceBundle`', function() {
    try {
      expect(setup(_.omit(opts,['sourceBundle']))).to.be.empty;
    } catch(e) {
      expect(e.toString()).to.contain('Param missing [sourceBundle]');
    }
  });

  it('Should return error invalid sourceBundle', function() {
    try {
      expect(setup(opts)).to.be.empty;
    } catch(e) {
      expect(e.toString()).to.contain('Invalid sourceBundle');
    }
  });

});
