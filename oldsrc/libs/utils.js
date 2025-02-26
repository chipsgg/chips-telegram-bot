const _ = require('lodash');
const fs = require('fs');

exports.formatDate = (date) => {
	let d = new Date(date),
		month = '' + (d.getMonth() + 1),
		day = '' + d.getDate(),
		year = d.getFullYear(),
		hours = d.getHours();

	if (month.length < 2) month = '0' + month;
	if (day.length < 2) day = '0' + day;

	let hourStr = hours.toString();

	if (hours == 2) hourStr = '0';
	if (hours == 14) hourStr = '12';
	if (hours < 10) hourStr = '0' + hours;

	var cd = [day, month, year].join('-') + ' ' + hourStr + ':00 UTC';
	return cd;
};

/**
 * Convert number to local string with decimal count
 * @param {string | number} num
 * @param {number} decimals
 * @returns {string}
 */
exports.convertDecimals = (num, decimals) =>
	Number(num).toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: decimals < 2 ? 2 : Math.min(8, decimals),
	});

/**
 * Get all directories in a path
 * @param {string} path
 */
exports.getDirectories = (path) => {
	return fs.readdirSync(path).filter(function (file) {
		return fs.statSync(path + '/' + file).isDirectory();
	});
};

exports.makeBroadcast =
	(listMethods, funcName) =>
	(...args) =>
		_.forEach(listMethods, (methods) => _.get(methods, funcName)(...args));
exports.Stack = class {
	// Array is used to implement stack

	/**
	 * @param {number} maxsize
	 */
	constructor(maxsize) {
		this.stack = [];
		this.maxsize = maxsize;
	}

	/**
	 * Push elements to the stack
	 * @param {...any} elements
	 */
	push(...elements) {
		for (let i = 0; i < elements.length; i++) {
			while (this.stack.length >= this.maxsize) {
				this.stack.splice(0, 1);
			}
			this.stack.push(elements[i]);
		}
	}

	// pop function
	pop() {
		if (this.stack.length == 0) throw new Error('Underflow');
		return this.stack.pop();
	}

	*popAll() {
		while (!this.isEmpty()) {
			yield this.pop();
		}
	}

	top() {
		if (this.isEmpty()) throw new Error('no items in stack');
		return this.stack[this.length() - 1];
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
};

exports.sleep = (t) => new Promise((resolve, reject) => setTimeout(resolve, t));
const rateLimit = new Map();

/**
 * Check if user has exceeded rate limit
 * @param {string} userId
 * @param {number} [limitMs=1000]
 * @returns {boolean}
 */
function checkRateLimit(userId, limitMs = 1000) {
	const now = Date.now();
	const lastRequest = rateLimit.get(userId) || 0;
	if (now - lastRequest < limitMs) {
		return false;
	}
	rateLimit.set(userId, now);
	return true;
}

module.exports = {
	...module.exports,
	checkRateLimit,
};
