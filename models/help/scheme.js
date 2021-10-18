
const _ = require('lodash');
module.exports = (commands, isAdmin) => {

  const getCommands = (showAdmin) => _.chain(commands)
    .keys()
    .map(name => ({ ..._.get(commands, name), name }))
    .filter(({ onlyAdmin }) => onlyAdmin == showAdmin)
    .map(({name, description }) => `/${name} - ${description}`)
    .join('\n')
    .value();
    const adminHelper = `🛡️ <strong>Admin commands</strong> 🛡️
${getCommands(true)}`

  return `ℹ️ <strong>Supported commands</strong> ℹ️
${getCommands(false)}
${isAdmin?adminHelper:''}`;
}