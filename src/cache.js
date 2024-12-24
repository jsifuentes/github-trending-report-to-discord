import fs from 'fs';
import path from 'path';

const dataDirectory = process.env.DATA_DIRECTORY || './data';

export function readFile(file) {
    return new Promise((resolve, reject) => {
        fs.readFile(path.join(dataDirectory, file), { encoding: 'utf8' }, function (err, data) {
            if (err) {
                return reject(err);
            }

            try {
                const parsed = JSON.parse(data);
                return resolve(parsed);
            } catch (e) {
                return reject(e);
            }
        });
    });
}

export function writeFile(file, data) {
    return new Promise((resolve, reject) => {
        fs.writeFile(path.join(dataDirectory, file), JSON.stringify(data), 'utf8', function (err) {
            if (err) {
                return reject(err);
            }

            return resolve();
        });
    });
}