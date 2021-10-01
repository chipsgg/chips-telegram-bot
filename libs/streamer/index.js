const _ = require('lodash');
const TwitchApi = require("node-twitch").default;
const Redis = require("ioredis");

module.exports = (options) => {
  const twitch = new TwitchApi({ ...options.twitch });
  const redis = new Redis(options.redis);
  const compactKey = (name) => `streamers:${name}`
  const encoder = (data) => JSON.stringify(data)
  const decoder = (data) => JSON.parse(data)

  const getStreamer = async (name) => await redis.get(compactKey(name))
  const deleteStreamer = async (name) => await redis.del(compactKey(name))
  const addStreamer = async (name) => {
    const streamer = {
      name,
      lastStatus: "offline",
      lastImpression: Date.now(),
      created: Date.now(),
      updated: Date.now()
    }
    await redis.set(compactKey(name), encoder(streamer));
    return streamer;
  }
  const listStreamers = async () => {
    const keys = await redis.keys(compactKey('*'));
    const streamers = [];
    for (var i = 0; i < keys.length; i++) {
      const streamer = decoder(await redis.get(keys[i]));
      streamers.push(streamer);
    }
    return streamers;
  }
  const poll = async () => {
    const allStreamers = await listStreamers();
    const channels = _.map(allStreamers, 'name')
    const onlineStreams = _.get(await twitch.getStreams({ channels }), 'data');
    const newStreamers = _.chain(allStreamers)
      .map(streamer => {
        const stream = _.find(onlineStreams, stream => stream.user_login == streamer.name);
        return {
          ...streamer,
          lastStatus: stream ? 'online' : 'offline'
        }
      })
      .filter(newStreamer => _.get(newStreamer, 'lastStatus') != _.get(_.find(allStreamers, oldStreamer => oldStreamer.name == newStreamer.name), 'lastStatus'))
      .value();

    const streamToAnnounce = _.chain(newStreamers)
      .filter(streamer => streamer.lastStatus == "online")
      .map(streamer => {
        const stream = _.find(onlineStreams, stream => stream.user_login == streamer.name);
        return {
          ...stream,
          url: `https://www.twitch.tv/${streamer.name}`,
          thumbnailUrl: stream.getThumbnailUrl()
        }
      })
      .sample()
      .value();

    _.forEach(newStreamers, (streamer) => {
      const updatedStreamer = { ...streamer, updated: Date.now() }
      if (streamToAnnounce.user_login == streamer.name) updatedStreamer.lastImpression = Date.now()
      redis.set(compactKey(updatedStreamer.name), encoder(updatedStreamer))
    })
    return streamToAnnounce
  }
  return {
    getStreamer,
    listStreamers,
    addStreamer,
    deleteStreamer,
    poll
  }
}