const fs = require('fs')
const { admins } = require('./config')
exports.formatDate = (date) => {
  var d = new Date(date),
    month = '' + (d.getMonth() + 1),
    day = '' + d.getDate(),
    year = d.getFullYear(),
    hours = d.getHours();

  if (month.length < 2)
    month = '0' + month;
  if (day.length < 2)
    day = '0' + day;

  if (hours == 2) hours = 0;
  if (hours == 14) hours = 12;
  if (hours < 10) hours = '0' + hours;

  var cd = [day, month, year].join('-') + " " + hours + ":00 UTC";
  return cd;
}
exports.isAdmin = (name) => {
  return name in admins
}
exports.convertDecimals = (num, decimals) => Number(num).toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: decimals < 2 ? 2 : Math.min(8, decimals),
})
exports.getDirectories = (path) => {
  return fs.readdirSync(path).filter(function (file) {
    return fs.statSync(path+'/'+file).isDirectory();
  });
}