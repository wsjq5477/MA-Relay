const test = require('node:test');

function linuxTest(name, options, run) {
  if (typeof options === 'function') { run = options; options = {}; }
  return test(name, {...options, skip:process.platform === 'linux' ? options?.skip : 'Requires Linux daemon, POSIX ownership or native process support'}, run);
}

module.exports = {linuxTest};
