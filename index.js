(() => {
  'use strict';

  const path = require('path');
  const os = require('os');
  const fs = require('fs');
  const url = require('url');
  const semver = require('semver');
  const fetch = require('node-fetch');

  function mkdir(path, mode) {
    return new Promise((resolve, reject) => {
      fs.mkdir(path, mode, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  function mkdtemp(prefix, options) {
    return new Promise((resolve, reject) => {
      fs.mkdtemp(prefix, options, (err, folder) => {
        if (err) {
          reject(err);
        } else {
          resolve(folder);
        }
      });
    });
  }

  class ArticfactFetcher {
    constructor({nodejsUrl ='https://nodejs.org/dist', outdir=os.tmpdir()}={}) {
      this._nodejsUrl = nodejsUrl;
      if (!path.isAbsolute(outdir)) {
        outdir = path.resolve(process.cwd(), outdir);
      }
      this._outdir = outdir;
    }

    _makeRequest(pathname) {
      const urlObject = url.parse(this._nodejsUrl);
      urlObject.pathname += pathname;
      const input = url.format(urlObject);
      console.log(`Making request to ${input}`);
      return fetch(input)
        .then((res) => {
          if (res.ok) {
            return res;
          } else {
            console.log(res.status);
            console.log(res.statusText);
            console.log(res.headers.raw());
            console.log(res.headers.get('content-type'));
            return Promise.reject(new Error(`failed to make request to ${input}`));
          }
        });
    }

    _getArtifact(version, outdir, filename) {
      return this._makeRequest(`/${version}/${filename}`)
        .then((res) => {
          return new Promise((resolve, reject) => {
            const filepath = path.join(outdir, filename);
            const output = fs.createWriteStream(filepath);
            res.body.once('error', reject);
            res.body.once('end', () => {
              res.body.removeListener('error', reject);
              resolve(filepath);
            });
            res.body.pipe(output);
          });
        });
    }

    run() {
      return Promise.resolve()
        .then(() => {
          if (this._outdir === os.tmpdir()) {
            return mkdtemp(path.join(os.tmpdir(), 'crispy-succotash-'))
              .then((folder) => {
                this._outdir = folder;
              });
          }
        })
        .then(() => console.log(`Output directory: ${this._outdir}`))
        .then(() => this._getInfos())
        .then((infos) => this._getLatestInfos(infos))
        .then((infos) => {
          return Promise.all(infos.map((info) => this._downloadInfoArtifacts(info, this._outdir)));
        });
    }

    _getInfos() {
      return this._makeRequest('/index.json')
        .then((res) => res.json());
    }

    _getLatestInfos(infos) {
      const latestVersions = new Map();
      infos.forEach((info) => {
        const {version} = info;
        if (semver.lt(version, '4.0.0')) {
          return;
        }
        const {major} = semver.parse(version);
        if (!latestVersions.has(major)) {
          latestVersions.set(major, info);
        } else {
          const currentInfo = latestVersions.get(major);
          if (semver.gt(version, currentInfo.version)) {
            latestVersions.set(major, info);
          }
        }
      });
      return Array.from(latestVersions.values());
    }

    _downloadInfoArtifacts(info, outdir) {
      const {version} = info;
      const infoOutdir = path.join(outdir, version);
      return mkdir(infoOutdir)
        .catch((err) => {
          if ('EEXIST' !== err.code) {
            return Promise.reject(err);
          }
        })
        .then(() => this._getArtifact(version, infoOutdir, 'SHASUMS256.txt'))
        .then(() => this._getArtifact(version, infoOutdir, `node-${version}-headers.tar.gz`))
        .then(() => this._getArtifact(version, infoOutdir, `node-${version}-headers.tar.xz`));
    }
  }

  module.exports = ArticfactFetcher;
})();
