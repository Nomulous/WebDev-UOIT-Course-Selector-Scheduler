/* Name: utils.js
 * Author: Devon McGrath
 * Description: This JS server file contains various utility JS functions.
 */

/**
 * Helper function to print something to the log function.
 *
 *	printer	the printer object with the log function.
 *	txt		the text to print to the log function.
 */
function echo(printer, txt) {
	var logFunc = console.log;
	if (printer && printer.logFunc) {
		logFunc = printer.logFunc;
	}
	logFunc(txt);
}

/**
 * The Printer class is responsible for printing text to a log function
 * (e.g. console.log), with a specified format.
 *
 *	logFunc		the function that takes text as an argument.
 *	defaultFg	the default foreground colour code.
 *	defaultBg	the default background colour code.
 */
function Printer(logFunc, defaultFg, defaultBg) {
	
	/** The function to print the text. */
	this.logFunc = logFunc;
	
	/** The default foreground colour. */
	this.defaultFg = defaultFg;
	
	/** The default background colour. */
	this.defaultBg = defaultBg;
	
	/**
	 * Prints a line of text to the screen with the specified colours and format.
	 *
	 *	txt			the text to print.
	 *	foreground	the foreground colour code.
	 *	background	the background colour code.
	 *	bold		the flag to use bold text.
	 */
	this.println = function(txt, foreground, background, bold) {
		var start = '', end = '', fg = this.defaultFg, bg = this.defaultBg;
		
		// Determine format
		if (fg || bg) { // default foreground/background colour
			fg = fg? fg : 0;
			bg = bg? bg : 0;
			start = '\033[' + bg + ';' + fg + 'm';
			end = '\033[0m';
		}
		if (foreground || background) { // foreground/background colour
			foreground = foreground? foreground : 0;
			background = background? background : 0;
			start = '\033[' + background + ';' + foreground + 'm';
			end = '\033[0m';
		} if (bold) { // bold text
			start += '\033[1m';
			end = '\033[0m';
		}
		
		// Actually print it
		txt = start + txt + end;
		echo(this, txt);
	}
}

// Export the necessary functions and objects
module.exports.FG = {'default': 0, 'black': 30, 'red': 31, 'green': 32,
	'yellow': 33, 'blue': 34, 'magenta': 35, 'cyan': 36, 'bright-black': 90,
	'bright-red': 91, 'bright-green': 92, 'bright-yellow': 93, 'bright-blue': 94,
	'bright-magenta': 95, 'bright-cyan': 96, 'bright-white': 97};
module.exports.BG = {'default': 0, 'black': 40, 'red': 41, 'green': 42,
	'yellow': 43, 'blue': 44, 'magenta': 45, 'cyan': 46, 'bright-black': 100,
	'bright-red': 101, 'bright-green': 102, 'bright-yellow': 103, 'bright-blue': 104,
	'bright-magenta': 105, 'bright-cyan': 106, 'bright-white': 107};
module.exports.out = new Printer(console.log);
module.exports.err = new Printer(console.error, module.exports.FG['bright-red']);
