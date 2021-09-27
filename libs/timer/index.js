const _ = require('lodash');
const Datastore = require('nedb');

module.exports = (filename = `data/timer.db`) => {
  const db = new Datastore({ filename, autoload: true });
  db.loadDatabase();
  db.persistence.setAutocompactionInterval(10 * 1000)
  db.ensureIndex({ fieldName: 'name', unique: true }, function (err) {
    if (err) {
      throw new Error(err)
    }
  });
  const minutesToTimestamp = (minutes) => minutes * 60 * 1000;
  const incLines = async () => {
    const timers = await listTimers()
    _.forEach(timers, (timer) => db.update(timer, { ...timer, lines: timer.lines + 1 }))
  }
  const hasTimer = (name) => new Promise((resolve, reject) => {
    db.count({ name }, (err, n) => {
      if (err) {
        reject(err)
      } else {
        resolve(n > 0)
      }
    })
  })
  const addTimer = (name, response, interval, lineMinimum) => new Promise((resolve, reject) => {
    const now = Date.now();
    db.insert({
      name,
      response,
      interval,
      lines: 0,
      lineMinimum,
      lastImpression: now,
      created: now,
      updated: now
    }, (err, doc) => {
      if (err) {
        reject(err);
      } else {
        resolve(doc);
      }
    });
  });
  const listTimers = () => new Promise((resolve, reject) => {
    db.find({}, (err, docs) => {
      if (err) {
        reject(err);
      } else {
        resolve(docs);
      }
    });
  });
  const deleteTimer = (name) => new Promise((resolve, reject) => {
    db.remove({ name }, {}, function (err, n) {
      if (err) {
        reject(err);
      } else {
        resolve(n > 0);
      }
    });
  });
  const poll = () => new Promise((resolve, reject) => {
    db.find({
      $where: function () {
        const linesRequired = this.lines >= this.lineMinimum;
        const showTime = (Date.now() - this.lastImpression) >= minutesToTimestamp(this.interval);
        return linesRequired && showTime;
      }
    }, (err, docs) => {
      if (err) {
        reject(err);
      } else {
        const doc = _.sample(docs)
        if (doc) {
          const newDoc = { ...doc, lines: 0, lastImpression: Date.now() }
          db.update(doc, newDoc, (err, n) => {
            if (err) {
              reject(err)
            } else {
              resolve(n > 0 ? newDoc : doc)
            }
          })
        } else {
          resolve(doc)
        }
      }
    });
  });

  return {
    hasTimer,
    listTimers,
    addTimer,
    deleteTimer,
    poll,
    incLines
  }
}