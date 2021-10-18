const _ = require('lodash');
module.exports = (context) => {
  const { API, models } = context;
  return {
    top: {
      description: "The ranking of the players on the different events",
      onlyAdmin: false,
      handler: (ctx) => {
        API.listActiveRaces(skip = 0, limit = 10)
          .then(async activeRaces => {
            Promise.all(_.map(activeRaces, (race) => new Promise((resolve, reject) => {
              API.listRaceRanks(race.id)
                .then(ranks => resolve({ ...race, ranks }))
                .catch(reject)
            })))
              .then(racesRanks => ctx.replyWithHTML(models.top(racesRanks), { disable_notification: true }));
          });
      }
    }
  };
};