const fs = require('fs');
const Path = require('path');
const spawn = require('child_process').spawn;
const { exists, getAllDirectories, getAllCFiles, ignoreAndFilter } = require('./helpers');
const helpers = require('./helpers');
const EventEmitter = require('events');
const commandExists = require('command-exists');
const promisify = require('es6-promisify').promisify;

const outFolder = Path.join(__dirname, '..', 'mbed-simulator-hal');
const outFile = Path.resolve(Path.join(outFolder, 'libmbed.bc')); // should this be configurable?
const ignoreFile = Path.join(outFolder, '.simignore');

let libmbed = {
    getAllDirectories: async function() {
        let cacheFile = Path.join(outFolder, 'directories.cache');

        if (await exists(cacheFile)) {
            return JSON.parse(await promisify(fs.readFile)(cacheFile), 'utf-8');
        }

        let dirs = await ignoreAndFilter(await getAllDirectories(outFolder), ignoreFile);
        await promisify(fs.writeFile)(cacheFile, JSON.stringify(dirs), 'utf-8');
        return dirs;
    },

    getAllCFiles: async function() {
        let cacheFile = Path.join(outFolder, 'cfiles.cache');

        if (await exists(cacheFile)) {
            return JSON.parse(await promisify(fs.readFile)(cacheFile), 'utf-8');
        }

        let dirs = await ignoreAndFilter(await getAllCFiles(outFolder), ignoreFile);
        await promisify(fs.writeFile)(cacheFile, JSON.stringify(dirs), 'utf-8');
        return dirs;
    },

    getPath: function() {
        return outFile;
    },

    exists: function() {
        return exists(outFile);
    },

    checkDependencies: async function() {
        try {
            await commandExists('mbed');
        }
        catch (ex) {
            throw 'Mbed CLI (mbed) is not installed. Follow the steps in https://github.com/armmbed/mbed-cli to continue';
        }

        try {
            // there's helpers.emccCmd, but the weird thing is that we need to spawn emcc.bat on Windows, but this still works...
            await commandExists('emcc');
        }
        catch (ex) {
            throw 'Emscripten (emcc) is not installed. Follow the steps in https://kripken.github.io/emscripten-site/docs/getting_started/downloads.html to continue. Make sure `emcc` is in your path.';
        }
    },

    build: async function(verbose) {
        await this.checkDependencies();

        // clear cache files
        let cacheFiles = [
            Path.join(outFolder, 'directories.cache'),
            Path.join(outFolder, 'cfiles.cache')
        ];
        await Promise.all(cacheFiles.map(async function(c) {
            if (await(exists(c))) {
                promisify(fs.unlink)(c);
            }
        }));

        let includeDirectories = await this.getAllDirectories();
        let cFiles = await this.getAllCFiles();
        let emterpretify = false; // no need for this yet

        let args = cFiles
            .concat(includeDirectories.map(i => '-I' + i))
            .concat(helpers.defaultBuildFlags)
            .concat([
                '-DMBEDTLS_TEST_NULL_ENTROPY',
                '-DMBEDTLS_NO_DEFAULT_ENTROPY_SOURCES',

                '-O2',
                '-o', outFile
            ]);

        if (emterpretify) {
            args = args.concat(helpers.emterpretifyFlags);
        }
        else {
            args = args.concat(helpers.nonEmterpretifyFlags);
        }

        args = args.filter(a => a !== '--emterpretify');

        if (verbose) {
            console.log(helpers.emccCmd + ' ' + args.join(' '));
            args.push('-v');
        }

        let cmd = await helpers.spawnEmcc(args);

        return new Promise((resolve, reject) => {
            let stdout = '';

            cmd.stdout.on('data', data => stdout += data.toString('utf-8'));
            cmd.stderr.on('data', data => stdout += data.toString('utf-8'));

            cmd.on('close', code => {
                if (code === 0) {
                    return resolve();
                }
                else {
                    return reject('Failed to build libmbed (' + code + ')\n' + stdout);
                }
            });
        });
    }
};

module.exports = libmbed;
