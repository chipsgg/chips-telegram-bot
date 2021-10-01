const _ = require('lodash');
const Redis = require("ioredis");

module.exports = (...args) => {
  const redis = new Redis(...args)
  const compactKey = (name) => `timer:${name}`
  const incLines = async () => {
    const timers = await listTimers()
    _.forEach(timers, (timer) => {
      redis.set(compactKey(timer.name), encoder({ ...timer, lines: timer.lines + 1, updated: Date.now() }))
    })
  }
  const encoder = (data) => JSON.stringify(data)
  const decoder = (data) => JSON.parse(data)

  const getTimer = async(name) => await redis.get(compactKey(name))
  const deleteTimer = async(name) => await redis.del(compactKey(name))
  const addTimer = async(name, response, interval, lineMinimum) => {
    const timer = {
      name,
      response,
      interval,
      lines: 0,
      lineMinimum,
      lastImpression: Date.now(),
      created: Date.now(),
      updated: Date.now()
    }
    await redis.set(compactKey(name), encoder(timer))
    return timer
  }
  const listTimers = async() =>{
    const keys = await redis.keys(compactKey('*'))
    const timers = []
    for(var i = 0; i < keys.length;i++){
      const timer = decoder(await redis.get(keys[i]))
      timers.push(timer)
    }
    return timers
  }
  const poll = async() => {
    const timers = await listTimers()
    const result = _.filter(timers, (timer) => {
      const linesRequired = timer.lines >= timer.lineMinimum;
      const showTime = (Date.now() - timer.lastImpression) >= timer.interval * 60 * 1000;
      return linesRequired && showTime;
    })
    const timer = _.sample(result)
    if(timer){
      const newTimer = { ...timer, lines: 0, lastImpression: Date.now(), updated: Date.now() }
      await redis.set(compactKey(newTimer.name), encoder(newTimer))
      return newTimer
    }
  }
  return {
    getTimer,
    listTimers,
    addTimer,
    deleteTimer,
    poll,
    incLines
  }
}