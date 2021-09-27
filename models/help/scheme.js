
module.exports = (isAdmin) => {
  const adminHelper = `🛡️ <strong>Admin commands</strong> 🛡️
/listTimers - List the existing timers with their parameters
/addTimer - Add a new timer
/deleteTimer - Delete a timer`
  return `ℹ️ <strong>Supported commands</strong> ℹ️
/top - The ranking of the players on the different events
/events - Ongoing events
/prices - The different cryptocurrencies and their values in dollars
/divs - The vault and rewards related
/groups - The different ambassadors
/luckiest - Ranking of the luckiest players
/bigwins - Ranking of players with big wins
${isAdmin?adminHelper:''}`;
}