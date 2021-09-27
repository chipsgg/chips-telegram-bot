const _ = require('lodash')

module.exports = (superAdmins) => (ctx, next) => {
  //if(ctx.from.id in superAdmins) return next();
  ctx.from._is_in_admin_list = false
  if (!ctx.from.is_bot){
    ctx.from._is_in_admin_list = _.includes(superAdmins, ctx.from.username)
  }
  if (ctx.chat.id > 0) {
    return next();
  }
  return ctx.telegram.getChatAdministrators(ctx.chat.id)
    .then(function (data) {
      if (!data || !data.length) return;
      ctx.chat._admins = data;
      ctx.from._is_in_admin_list = ctx.from._is_in_admin_list || data.some(adm => adm.user.id === ctx.from.id);
    })
    .catch(console.error)
    .then(_ => next(ctx));
}