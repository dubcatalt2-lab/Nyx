const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const root = path.join(__dirname, '..', 'release');
const entries = fs.readdirSync(root).filter(name => /^Nook-Agent-.*-setup\.exe$/.test(name)).sort();
if (!entries.length) throw Error('No Windows installer was built.');
const content = entries.map(name => createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex') + '  ' + name).join('\n') + '\n';
fs.writeFileSync(path.join(root, 'SHA256SUMS.txt'), content);
process.stdout.write(content);
