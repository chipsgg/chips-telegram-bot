const _ = require('lodash')
module.exports = async (ctx, next) => {
  if (ctx.update.message && !ctx.update.message.from.is_bot && ctx.update.message.chat.type != "private") {
    const entity = _.first(ctx.update.message.entities)
    if (entity && entity.offset == 0 && entity.type == "bot_command") {
      ctx.deleteMessage(ctx.update.message.message_id)
    }
  }
  await next()
}