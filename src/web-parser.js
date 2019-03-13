/* Name: web-parser.js
 * Author: Devon McGrath
 * Description: This JS file does all the web parsing and returns the
 * parsed data.
 */

// Required modules
var http = require('http');
var url = require('url');
var querystring = require('querystring');
var System = require('./utils');

// Main pages
var TERM_PAGE = {
	"domain": "ssbp.mycampus.ca",
	"uri": "/prod_uoit/bwckschd.p_disp_dyn_sched?TRM=U",
	"getData": function (termId) {
		return 'p_calling_proc=bwckschd.p_disp_dyn_sched&TRM=U&p_term=' + termId;
	},
	"postUri": "/prod_uoit/bwckgens.p_proc_term_date",
	"terms": []
};
var CATALOG_PAGE = {
	"domain": "catalog.uoit.ca",
	"uri": "/"
}

// HTML data storage
var progLinks;

/**
 * Gets web page data by submitting a HTTP request to the specified domain/URI.
 * Once a response is received, it is sent to the callback function.
 *
 * domain	the domain to send the request to (e.g. www.google.ca)
 * uri		the path to a resource (e.g. /home)
 * callback	the function called with the response data
 * method	the type of request (e.g. GET)
 * data		the data to send in the request
 */
function getWebPageData(domain, uri, callback, method, data) {
	
	// Fix the method if necessary
	if (!method) {
		method = 'GET';
	}
	method = method.toUpperCase();
	
	// HTTP request options
	var opts = {
		"host": domain,
		"path": uri,
		"method": method,
		"port": "80",
		"headers": {}
	};
	if (data) { // If posting data
		opts.headers = {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': Buffer.byteLength(data)
		};
	}
	
	// Generate request
	var req = http.request(opts, function(res) {
		var out = '';
		res.on('data', function(chunk) {
			out += chunk;
		});
		res.on('end', function() {
			callback(out);
		});
	});
	req.on('error', function(err) {
		var msg = 'Error: ' + err.message;
		System.err.println(msg);
		callback(msg);
	});
	
	// Send it
	if (data) {
		req.write(data);
	}
	req.end();
}

/**
 * Gets the available terms to create a schedule for. Calls a callback function
 * with the array of terms.
 *
 *	callback	the callback function to receive the terms.
 */
function getTerms(callback) {
	
	// Check if the terms have already been requested before
	if (TERM_PAGE.terms.length) {
		System.out.println('\t              > using cached terms', System.FG['bright-green']);
		callback(TERM_PAGE.terms);
		return;
	}

	// Make the request
	System.out.println('\t              > getting terms...', System.FG['bright-yellow']);
	getWebPageData(TERM_PAGE.domain, TERM_PAGE.uri, function(html) {
		
		var form = {};
		try {
			
			// Get only the form
			var parts = html.split(/<form /i);
			if (parts.length > 1) {
				html = "<form " + parts[1];
			}
			parts = html.split(/<\/form>/i);
			html = parts[0] + "</form>";
			form = getFormData(html)[0];
			
			// Get the terms
			if (form) {
				for (var i = 0; i < form.inputs.length; i ++) {
					if (form.inputs[i].values.length > 1) {
						var v = form.inputs[i].values, n = v.length;
						for (var j = 0; j < n; j ++) {
							if (v[j].length > 0) {
								TERM_PAGE.terms.push(v[j]);
							}
						}
						break;
					}
				}
			}
		} catch (e) {System.err.println(e);}
		TERM_PAGE.form = form;
		
		System.out.println('\t              > ' + TERM_PAGE.terms.length + ' terms parsed',
			System.FG['bright-yellow']);
		
		// Call the callback
		callback(TERM_PAGE.terms);
	}, 'GET');
}

/**
 * Gets the programs available to take and sends them back using the HTTP
 * request from the client. Each line sent to the client is a text string
 * with the program name.
 *
 * req	the initial client request.
 * res	the HTTP response object.
 */
function getPrograms(req, res) {
	
	// Get the URL
	var reqUrl = url.parse(req.url);
	
	// If it has ?[number] in the url, get the program [number] data
	if (reqUrl.search && progLinks) { 
		var number = parseInt(reqUrl.search.slice(1));
		if (number >= 0 && number < progLinks.length) {
			getWebPageData(CATALOG_PAGE.domain, '/'+progLinks[number].uri,
				function(html) {getCourses(html, res);}, 'GET');
			return;
		}
	}
	
	// If a list of programs was already requested earlier
	if (progLinks) {
		sendProgramList(res);
		return;
	}
	
	// If not, send the HTTP requests needed to get the data
	getWebPageData(CATALOG_PAGE.domain, CATALOG_PAGE.uri, function(html) {
		
		// No data
		if (html.length == 0) {
			sendProgramList(res);
			return;
		}
		
		// Get the link to the 'Programs (by Degree)' page
		html = html.split(/Programs \(by Degree\)/i)[0];
		var uri = '', domain = CATALOG_PAGE.domain, parts;
		parts = html.split(/<a href="/i);
		html = parts[parts.length - 1]; // get the last link
		html = html.split('"')[0]; // get only the link
		html = html.replace(/http(s*):\/\//, '');
		var start = html.indexOf('/');
		if (start < 1) {
			uri = html;
		} else {
			domain = html.slice(0, start);
			uri = html.slice(start);
		}
		
		// If no URI found, send nothing
		if (uri.length == 0) {
			sendProgramList(res);
			return;
		}
		
		// Send the get request to the page with the program list
		getWebPageData(domain, uri, function(data) {
			
			// No data
			if (data.length == 0) {
				sendProgramList(res);
				return;
			}
			
			// Get only the relevant HTML
			var parts;
			try {
				parts = data.split(/<strong>Bachelor of Applied Science \(Honours\)<\/strong><\/p>/i);
				data = parts[parts.length - 1];
				data = data.split(/<strong>Co-operative Education<\/strong>/i)[0];
			} catch (e) {System.err.println(e);}
			data = data.replace(/&#8211;/g, '-');
			parts = data.split(/<a href="/i);
			
			// Create the list of programs
			progLinks = [];
			var n = parts.length;
			for (var i = 1; i < n; i ++) {
				var p = {"program": "", "uri": ""}, d = parts[i];
				p.uri = d.split('"')[0];
				try {
					p.program = d.split('>')[1].split('<')[0];
					progLinks.push(p);
				} catch (e) {System.err.println(e);}
			}
			sendProgramList(res);
		}, 'GET');
	}, 'GET');
}

/** 
 * Sends the list of programs available to the client.
 *
 *	res	the HTTP response object to respond to the client.
 */
function sendProgramList(res) {
	
	// Generate the output
	var list = '', n = progLinks && progLinks.length? progLinks.length : 0;
	for (var i = 0; i < n; i ++) {
		list = list + progLinks[i].program + '\n';
	}
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.write(list);
	res.end();
}

/**
 * Parses the HTML from a program page and gets the list of courses needed to
 * be taken to complete the program. Then, the function sends the data as plain
 * text back to the client.
 *
 *	res	the HTTP response object to respond to the client.
 */
function getCourses(html, res) {
	if (!html) {html = '';}
	
	// Split by year
	var years = html.split(/<\/a>Year /i), out = '';
	for (var i = 1; i < years.length; i ++) {
		var d = years[i].replace(/&#160;/g, ' ').replace(/&#8211;/g, '-');
			
		// Get the year
		out = out + '<th>Year ' + d.split('<', 2)[0] + '</th>\n';
		
		// Get the text from the HTML
		var txt = ('<' + d.slice(d.indexOf('<'))).replace(/<[^>]+>/g, '\n');
		txt = txt.replace(/\n{2,}/g, '\n');

		// Trim the string to only necessary content
		var lines = txt.split('\n'), n = lines.length, lastAdd = 0;
		var exp = /(Elective|^or|^one of|^Semester|^[a-z]{3,4} [0-9]{4})/i;
		txt = '';
		for (var j = 0; j < n && (j - lastAdd) < 7; j ++) {
			if (exp.test(lines[j])) {
				txt += lines[j] + '\n';
				lastAdd = j;
			}
		}
		txt = txt.replace(/(^\n+|\n+$)/g, '');
		
		out += txt + '\n';
	}
	
	// Send the response to the client
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.write(out);
	res.end();
}

/**
 * Gets the sections for the specified course and term.
 *
 *	term		the term (e.g. 201701)
 *	subject		the course subject (e.g. CSCI)
 *	code		the code for the course (e.g. 1061U)
 *	callback	the callback function to receive the parsed sections
 */
function getSections(term, subject, code, callback) {
	
	// Check that there is a callback
	if (!callback) {
		return false;
	}
	
	// Form data to post to mycampus
	term = encodeURIComponent(term);
	subject = encodeURIComponent(subject);
	code = encodeURIComponent(code);
	var formData = 'TRM=U&term_in='+term+'&sel_subj=dummy&sel_day=dummy'
				+ '&sel_schd=dummy&sel_insm=dummy&sel_camp=dummy'
				+ '&sel_levl=dummy&sel_sess=dummy&sel_instr=dummy'
				+ '&sel_ptrm=dummy&sel_attr=dummy&sel_subj='+subject
				+ '&sel_crse='+code+'&sel_title=&sel_schd=%25'
				+ '&sel_insm=%25&sel_from_cred=&sel_to_cred=&sel_camp=%25'
				+ '&begin_hh=0&begin_mi=0&begin_ap=a&end_hh=0&end_mi=0'
				+ '&end_ap=a';
	
	// Make the POST request
	getWebPageData('ssbp.mycampus.ca', '/prod_uoit/bwckschd.p_get_crse_unsec', function(data) {
		
		var sections = [];
		
		// Parse the sections one at a time
		data = updateSectionHTML(data);
		var rawSections = data.split(/"ddheader"/gi), n = rawSections.length;
		var now = new Date();
		for (var i = 1; i < n; i ++) {
			
			var sectionHtml = rawSections[i];
			
			// Create the session object
			var s = {crn: 0, title: 'Unavailable', remaining: 0, schType: 'Other',
				campus: 'UOIT - Other',
				lastUpdated: now, subject: 'TBD', code: 'TBD', term: term,
				instructor: 'TBA', instructionMethod: 'TBD', linkedSections: [], times: []};
			
			// Get the title, subject, code, CRN
			var parts;
			try {
				parts = sectionHtml.split('<', 2)[0].split('>');
				if (parts.length > 1) {
					parts = parts[1].split(/ - /gi);
					s.crn = parseInt(parts[parts.length-3]);
					var course = parts[parts.length-2].split(' ');
					s.subject = course[0];
					s.code = course[1];
					s.title = parts[0];
				}
			} catch (err) { // error parsing; not regular format
				System.err.println('web-parser.getSections: error parsing section');
			}
			
			// Get the schedule type
			if (sectionHtml.search(/<br \/>\nLecture/i) >= 0) {
				s.schType = 'Lecture';
			} else if (sectionHtml.search(/<br \/>\nTutorial/i) >= 0) {
				s.schType = 'Tutorial';
			} else if (sectionHtml.search(/<br \/>\nLab/i) >= 0) {
				s.schType = 'Lab';
			} else if (sectionHtml.search(/<br \/>\nLecture & Lab/i) >= 0) {
				s.schType = 'Lecture & Lab';
			} else if (sectionHtml.search(/<br \/>\nThesis\/Project/i) >= 0) {
				s.schType = 'Thesis/Project';
			}
			
			// Get the location (campus)
			if (sectionHtml.search(/L\0UOIT - North Oshawa/i) >= 0) {
				s.campus = 'UOIT - North Oshawa';
			} else if (sectionHtml.search(/L\0UOIT- Downtown Oshawa/i) >= 0) {
				s.campus = 'UOIT - Downtown Oshawa';
			} else if (sectionHtml.search(/L\0UOIT-Georgian/i) >= 0) {
				s.campus = 'UOIT - Georgian Oshawa';
			} else if (sectionHtml.search(/L\0UOIT-Online/i) >= 0) {
				s.campus = 'UOIT - Online';
			}
			
			// Get the instruction method
			if (sectionHtml.search(/<br \/>\nIn-class Delivery/i) >= 0) {
				s.instructionMethod = 'In-class Delivery';
			} else if (sectionHtml.search(/<br \/>\nIn-class & Online Delivery/i) >= 0) {
				s.instructionMethod = 'In-class & Online Delivery';
			} else if (sectionHtml.search(/<br \/>\nOffsite/i) >= 0) {
				s.instructionMethod = 'Offsite';
			} else if (sectionHtml.search(/<br \/>\nVirtual Meet Times/i) >= 0) {
				s.instructionMethod = 'Virtual Meet Times';
			} else if (sectionHtml.search(/<br \/>\nSection is Fully Online/i) >= 0) {
				s.instructionMethod = 'Online';
			}
			
			// Get the capacity
			parts = sectionHtml.split('@\0', 5);
			if (parts.length > 3) {
				s.remaining = parseInt(parts[3].split('<', 2)[0].replace(/>/g, ''));
			}
			
			// Get the linked sections
			if (sectionHtml.search(/Show linked Section\(s\)<\/td>\n/i) >= 0) {
				parts = sectionHtml.split(/\( CRN: /gi);
				var m = parts.length;
				for (var j = 1; j < m; j ++) {
					var value = parseInt(parts[j].split(' ', 2)[0]);
					if (!isNaN(value)) {
						s.linkedSections.push({crn: value});
					}
				}
			}
			
			// Get the meet times
			s.times = getMeetTimes(sectionHtml);
			if (s.times.length > 0) {
				var t1 = s.times[0];
				s.instructor = t1.instructor;
				s.location = t1.location;
			}
			
			sections.push(s);
		}
		
		// Handle the results
		callback(sections);
	}, 'POST', formData);
}

/**
 * Converts HTML representing course sections (from mycampus) to an
 * easier-to-parse format.
 *
 *	html	the HTML to update from mycampus.
 */
function updateSectionHTML(html) {
	if (!html) {return '';}
	
	// Remove non-essential HTML for parsing the sections
	var parts = html.split('"datadisplaytable"');
	if (parts.length < 2) { // not a valid page with sections from mycampus
		return '';
	}
	html = parts[1];
	
	// Shorten the HTML and make parsing easier
	html = html.replace(/<abbr[^>]+>P<\/abbr>/gi, 'P');
	html = html.replace(/<abbr[^>]+>TBA<\/abbr>/gi, 'TBA');
	html = html.replace(/<b><\/b><\/SPAN>/gi, 'L\0'); // location
	html = html.replace(/"dbdefault"/gi, '@\0'); // seats/meet times
	
	return html;
}

/**
 * Gets the individual meet times associated with a section.
 *
 *	sectionHtml	the HTML for a single section.
 */
function getMeetTimes(sectionHtml) {
	
	var times = [];
	if (!sectionHtml) {return times;}
	var pos = sectionHtml.search(/Scheduled Meeting Times<\/caption>\n/i);
	if (pos < 0) {
		return times;
	}
	
	// Adjust HTML
	sectionHtml = sectionHtml.slice(pos);
	sectionHtml = sectionHtml.split(/<\/TR>\n<\/TABLE>/i, 2)[0];
	
	// Get each meeting time
	var parts = sectionHtml.split(/<\/TR>\n/i), n = parts.length;
	for (var i = 1; i < n; i ++) {
		var time = {start: 0, end: 0, day: 'X', location: 'TBA',
			startDate: null, endDate: null, scheduleType: 'Lecture', instructor: 'TBA'};

		// Break it into lines
		var lines = parts[i].split('\n');
		for (var j = 1; j < lines.length; j ++) {
			lines[j] = lines[j].split(/<\/TD>/i, 2)[0].split('>')[1];
		}
		
		// Get the basic info
		time.day = lines[3];
		time.location = lines[4];
		time.scheduleType = lines[6];
		time.instructor = lines[7];
		
		// Get the date info
		var startEnd = lines[5].split(' - ');
		time.startDate = new Date(startEnd[0]);
		time.endDate = new Date(startEnd[1]);
		startEnd = lines[2].split(' - ');
		for (var j = 0; j < 2; j ++) {
			
			// Determine morning/afternoon
			var t = startEnd[j];
			if (!t) {time.end = time.start; break;}
			var hours = t.search(/pm/i) > 0? 12 : 0;
			t = t.split(' ')[0]; // remove am/pm
			
			// Determine hours and minutes
			var timeParts = t.split(':');
			timeParts[0] = parseInt(timeParts[0]) % 12;
			timeParts[1] = parseInt(timeParts[1]);
			if (!isNaN(timeParts[0]) && !isNaN(timeParts[1])) {
				hours += timeParts[0];
				var mins = timeParts[1];
				var totalMins = mins + 60 * hours;
				if (j == 0) {
					time.start = totalMins;
				} else {
					time.end = totalMins;
				}
			}
		}
		
		times.push(time);
	}
	
	return times;
}

/**
 * Parses a raw HTML string to get form data. This includes the action, method,
 * inputs, and default values.
 *
 *	html	the raw HTML string to parse.
 * Returns an array of form objects, each with the properties: 'action' : string,
 * 'method' : string, 'inputs' : Array({'name' : string, 'values' : Array(string)}).
 */
function getFormData(html) {
	if (!html) {return [];}
	
	// Parse each form individually
	var forms = [];
	var s = html.split(/<form /i);
	for (var i = 1; i < s.length; i++) {
		var f = s[i].split(/<\/form>/i, 2)[0];
		var obj = {"action": "", "method": "GET", "inputs": []};
		var tmp = f.split('>', 2);
		
		// Get the basic form info
		obj.action = extractAttribute(tmp[0], 'action');
		var r = extractAttribute(tmp[0], 'method');
		if (r.length > 0) {
			obj.method = r.toUpperCase();
		}
		
		// Get the form elements
		f = f.replace(/(\n|\r\n)/g, '');
		var m = f.match(/(<input[^>]*>|<select(.+?)<\/select>|<textarea(.+?)<\/textarea>)/gi);
		var n = m? m.length : 0;
		for (var j = 0; j < n; j ++) {
			var inObj = {"name": extractAttribute(m[j], 'name'), "values": []};

			// Handle the different inputs
			if (!/^<select/i.test(m[j])) { // <input .../> and <textarea></textarea>
				inObj.values.push(extractAttribute(m[j], 'value'));
			} else { // <select>...</select>
				// Check for 'selected' option
				var opt = m[j].match(/<option[^>]+selected[^>]*>/i);
				if (opt) {
					inObj.values.push(extractAttribute(opt[0], 'value'));
					m[j] = m[j].replace(opt[0], '');
				}
				opt = m[j].match(/<option[^>]+>/gi);
				if (opt) {
					for (var k = 0; k < opt.length; k ++) {
						inObj.values.push(extractAttribute(opt[k], 'value'));
					}
				}
			}
			obj.inputs.push(inObj);
		}
		
		forms.push(obj);
	}
	
	return forms;
}

/**
 * Gets the specified attribute value. E.g. if the HTML is <input name="a" />,
 * the attr(ibute) is name, 'a' would be returned.
 *
 *	html	the HTML with attributes.
 *	attr	the attribute to get.
 * Returns the value of the attribute, or empty if it wasn't found.
 */
function extractAttribute(html, attr) {
	if (!html || !attr) {return '';}
	var exp = new RegExp(attr + '="[^"]*"', 'gi');
	var m = html.match(exp);
	if (m) { // attr="[value]"
		return m[0].split('"')[1];
	} else { // attr='[value]'
		exp = new RegExp(attr + "='[^']*'", 'gi');
		m = html.match(exp);
		if (m) {
			return m[0].split("'")[1];
		}
	}
	
	// No match
	return '';
}

// Export the necessary functions
module.exports.getTerms = getTerms;
module.exports.getPrograms = getPrograms;
module.exports.getSections = getSections;