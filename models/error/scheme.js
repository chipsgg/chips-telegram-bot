const assert = require('assert')

module.exports = (name, message) => {
  assert(name, "requires name");
  assert(message, "requires message");

  return `⚠️ <strong>${name}</strong> ⚠️

${message}`;
}