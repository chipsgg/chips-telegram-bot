const _ = require('lodash');
const { getDirectories } = require('../utils');

module.exports = (context) => ({
  ..._.reduce(getDirectories(__dirname), (prev, dirName) => {
    prev = {
      ...prev,
      ...require(`./${dirName}`)(context)
    }
    return prev
  }, {})
});