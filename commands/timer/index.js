module.exports = (context) => ({
  addTimer: require('./addTimer')(context),
  deleteTimer: require('./deleteTimer')(context),
  listTimers: require('./listTimers')(context)
});