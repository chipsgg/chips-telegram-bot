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