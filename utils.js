const _ = require("lodash");
const fs = require("fs");
exports.formatDate = (date) => {
  var d = new Date(date),
    month = "" + (d.getMonth() + 1),
    day = "" + d.getDate(),
    year = d.getFullYear(),
    hours = d.getHours();

  if (month.length < 2) month = "0" + month;
  if (day.length < 2) day = "0" + day;

  if (hours == 2) hours = 0;
  if (hours == 14) hours = 12;
  if (hours < 10) hours = "0" + hours;

  var cd = [day, month, year].join("-") + " " + hours + ":00 UTC";
  return cd;
};
exports.convertDecimals = (num, decimals) =>
  Number(num).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals < 2 ? 2 : Math.min(8, decimals),
  });
exports.getDirectories = (path) => {
  return fs.readdirSync(path).filter(function (file) {
    return fs.statSync(path + "/" + file).isDirectory();
  });
};
<<<<<<< HEAD
exports.makeBroadcast = (listMethods, funcName) => (...args) => _.forEach(listMethods, (methods) => _.get(methods, funcName)(...args));

exports.Stack = class {
  // Array is used to implement stack 
  constructor(maxsize) {
    this.stack = [];
    this.maxsize = maxsize;
  }
  // push function 
  push(...elements) {
    for(let i=0; i < elements.length;i++){
      while (this.stack.length >= this.maxsize){
        this.stack.splice(0, 1)
      }
      this.stack.push(elements[i])
    }
  }
  // pop function 
  pop() {
    if (this.stack.length == 0) throw new Error("Underflow");
    return this.stack.pop();
  }
  *popAll(){
    while(!this.isEmpty()){
      yield this.pop()
    }
  }
  top(){
    if(this.isEmpty()) throw new Error("no items in stack")
    return this.stack[this.length - 1];
  }
  // length function 
  length() {
    // return stack legth
    return this.stack.length;
  }
  // isEmpty function 
  isEmpty() {
    // return true if stack is empty 
    return this.stack.length == 0;
  }
}
=======
exports.makeBroadcast =
  (listMethods, funcName) =>
  (...args) =>
    _.forEach(listMethods, (methods) => _.get(methods, funcName)(...args));
>>>>>>> d4381ecafb4ad1e690b74fd5eaa607eab52fbf8d
