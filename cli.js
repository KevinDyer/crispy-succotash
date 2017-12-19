#!/usr/bin/env node
(() => {
  'use strict';

  const {version} = require('./package.json');
  const program = require('commander');
  program
    .version(version)
    .option('-o, --out-dir <out-dir>', 'Output Directory')
    .parse(process.argv);

  const {outDir} = program;

  const ArtifactFetcher = require('.');
  const fetcher = new ArtifactFetcher({outdir: outDir});

  Promise.resolve()
    .then(() => fetcher.run())
    .then(() => console.log('Done.'))
    .catch((err) => console.error(err));
})();
