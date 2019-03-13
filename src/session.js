/* Name: session.js
 * Author: Devon McGrath
 * Description: This JS server file manages user's sessions with cookies.
 */

// Modules
var http = require('http');
var mongoose = require('mongoose');
var Cookies = require('cookies');
var uuid = require('uuid/v1');
var webParser = require('./web-parser');
var System = require('./utils');

// Constants
const SESSION_COOKIE = 'uoit-course-sch-session';
const DB = 'mongodb://localhost:27017/uoit-course-scheduler';
const MAX_SECTION_AGE_MS = 1 * 24 * 60 * 60 * 1000; // i.e. 1 day

// Database configuration
System.out.println('Connecting to database...', System.FG['bright-yellow']);
var Schema = mongoose.Schema;
mongoose.Promise = global.Promise;
mongoose.connect(DB, function(err) {
	if (err) {
		System.err.println('Failed to connect to database.');
		System.out.println('Please start the database.');
		process.exit(1); // TERMINATE
	} else {
		System.out.println('Connected to database.', System.FG['bright-yellow']);
	}
});

// Database tables
var User = mongoose.model('users', new Schema({
		sid: {type: String, index: true}, term: String, sections: [
			{crn: Number, term: String}
		], courses: [{subject: String, code: String, term: String}], lastAccessed: Date
}, {collection: 'users'}));
var Section = mongoose.model('sections', new Schema({
	crn: {type: Number, index: true}, title: String, remaining: Number, schType: String, campus: String,
	lastUpdated: Date, subject: String, code: String, term: {type: String, index: true},
	instructor: String, instructionMethod: String, linkedSections: [{crn: Number}],
	times: [{start: Number, end: Number, day: String, location: String,
			startDate: Date, endDate: Date, scheduleType: String, instructor: String}]
}, {collection: 'sections'}));

/**
 * Checks if something should be updated based on the date it was entered and
 * the current date.
 *	date1		the date to check against
 *	maxDeltaMs	the maximum number of milliseconds that the date is valid for
 */
function needsUpdate(date, maxDeltaMs) {
	return Math.abs(new Date() - date) > maxDeltaMs;
}

/**
 * Saves session info in the session cookie.
 *	req		the HTTP request
 *	res		the HTTP response
 *	data	the data to put in the cookie
 */
function setSession(req, res, data) {
	var cookies = new Cookies(req, res);
	cookies.set(SESSION_COOKIE, data);
}

/**
 * Gets the session info from the session cookie.
 *	req	the HTTP request
 *	res	the HTTP response
 */
function getSession(req, res) {
	var cookies = new Cookies(req, res);
	var session = cookies.get(SESSION_COOKIE);
	session = session? session : '';
	return session;
}

/**
 * Generates a new session ID, puts it in the database, and returns it.
 */
function genID(afterInsertCallback) {
	var id = uuid();
	
	// Add the new user to the database
	var newUser = new User({sid: id, term: 'Not selected', courses: [],
		lastAccessed: new Date()});
	newUser.save(function(err) {
		
		// Insert failed
		if (err) {
			System.err.println('DB ERROR: failed to insert user: ' + err);
		}
		
		// Call the callback function
		if (afterInsertCallback) {
			afterInsertCallback(id, err);
		}
	});
	
	return id;
}

/**
 * Checks if the specified user ID is in the database.
 *	id			the ID to check for
 *	callback	the callback function 
 */
function userExists(id, callback) {
	User.find({sid: id}).then(function(results) {
		var found = results.length > 0;
		
		// If something was found, update the last accessed time
		if (found) {
			User.update({sid: id}, {lastAccessed: new Date()},
				{multi: false}, function() {});
		}
		
		// Tell the callback if something was found
		callback(found? results[0] : false);
	});
}

/**
 * Gets the info of a user in tab-separated format with term	<courses...>
 *	id			the id of the user
 *	callback	the callback function to receive the string of info
 */
function getInfo(id, callback) {
	User.find({sid: id}).then(function(results) {
		
		// Call the callback with an object
		var res = results.length == 0? {} : results[0];
		callback(res);
	});
}

/**
 * Adds a course to the specified user selection.
 *
 *	req		the HTTP request.
 *	res		the HTTP response.
 *	term	the term (e.g. 201801).
 *	subject	the course subject (e.g. CSCI).
 *	code	the course code (e.g. 1061U).
 *	id		the user ID to update.
 */
function addCourse(req, res, term, subject, code, id) {
	
	// Check if the user exists
	userExists(id, function(usr) {
		
		// User does not exist
		if (!usr) {
			System.err.println('\t              > cannot find user');
			res.status(500).send('');
			return false;
		}
		
		// Check if they already have the course added
		var found = false, n = usr.courses.length;
		for (var i = 0; i < n; i ++) {
			var c = usr.courses[i];
			if (c.term == term && c.subject == subject && c.code == code) {
				found = true;
				break;
			}
		}
		if (found) {
			System.out.println('\t              > user already added ' + subject + ' ' + code,
				System.FG['bright-yellow']);
			res.send('1'); // no update
			return true;
		}
		
		// Check database for course
		var subjectExp = new RegExp('^' + subject, 'i');
		var codeExp = new RegExp('^' + code, 'i');
		Section.find({term: term, subject: subjectExp, code: codeExp}).then(function(results) {
			
			// Sections do not exist
			if (results.length == 0) {
				findSections(req, res, term, subject, code, usr);
			}
			
			// Check that only one course was found
			else {
				
				// There was one course found
				var courses = getCourses(results), n = courses.length;
				if (n == 1) {
					var course = {
						term: courses[0][0].term,
						subject: courses[0][0].subject,
						code: courses[0][0].code
					};
					System.out.println('\t              > adding ' +
						course.subject + ' ' + course.code + ' from cache',
						System.FG['bright-green']);
					
					// Update the database
					User.update({sid: id}, {$push: {courses: course}},
					{multi: false}, function(err, numAffected) {
						if (err || numAffected.nModified != 1) {
							System.err.println('DB COURSE PUSH FAIL: ' + (err? err : 'no users updated'));
							System.err.println('         for course: "' + JSON.stringify(course) + '"');
						}
					});
					
					// Send the course that was added
					res.send(course.term + '\t' + course.subject + '\t' + course.code);
				}
				
				// Multiple courses found
				else {
					res.send('3'); // more than one match, please narrow search
				}
			}
		});
	});
}

/**
 * Finds the course specified and adds it to the database. Adds the course to
 * the user's courses if it successfully finds the course.
 *
 *	req		the HTTP request.
 *	res		the HTTP response.
 *	term	the term (e.g. 201801).
 *	subject	the course subject (e.g. CSCI).
 *	code	the course code (e.g. 1061U).
 *	usr		the user object to update.
 */
function findSections(req, res, term, subject, code, usr) {
	
	// Make a request to the web parser
	webParser.getSections(term, subject, code, function(sections) {
		
		// No sections found
		if (!sections || sections.length == 0) {
			System.err.println('\t              > cannot find ' + subject + ' ' +
				code + ' for term ' + term);
			res.send('2'); // bad search
			return false;
		}
		
		// There was one course found
		var courses = getCourses(sections), n = courses.length;
		if (n == 1) {
			var course = {
				term: courses[0][0].term,
				subject: courses[0][0].subject,
				code: courses[0][0].code
			};
			System.out.println('\t              > adding ' + course.subject +
				' ' + course.code + ' from parsed sections', System.FG['bright-green']);
			
			// Update the database
			User.update({sid: usr.sid}, {$push: {courses: course}},
			{multi: false}, function(err, numAffected) {
				if (err || numAffected.nModified != 1) {
					System.err.println('DB COURSE PUSH FAIL: ' + (err? err : 'no users updated'));
					System.err.println('         for course: "' + JSON.stringify(course) + '"');
				}
			});
			
			// Send the course that was added
			res.send(course.term + '\t' + course.subject + '\t' + course.code);
		}
		
		// Multiple courses found
		else {
			res.send('3'); // more than one match, please narrow search
		}
		
		// Add the sections to the database
		System.out.println('DB: inserting sections...', System.FG['bright-yellow']);
		for (var i = 0; i < n; i ++) {
			var sectionArr = courses[i], m = sectionArr.length;
			for (var j = 0; j < m; j ++) {
				var s = sectionArr[j];
				Section.update({crn: s.crn}, s, {upsert: true}, function(err) {
					if (err) {
						System.err.println('DB ERROR: could not insert section, ' + err);
					}
				});
			}
		}
		System.out.println('DB: insertions finished calling', System.FG['bright-yellow']);
	});
}

/**
 * Sends an object as JSON to the client.
 *
 *	req		the HTTP request.
 *	res		the HTTP response.
 *	json	the JSON object to send.
 */
function sendJSON(req, res, json) {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(json));
}

/**
 * Removes a course from the specified user selection.
 *
 *	req		the HTTP request.
 *	res		the HTTP response.
 *	term	the term (e.g. 201801).
 *	subject	the course subject (e.g. CSCI).
 *	code	the course code (e.g. 1061U).
 *	id		the user ID to update.
 */
function removeCourse(req, res, term, subject, code, id) {
	
	// Check if the user exists
	userExists(id, function(usr) {
		
		// User does not exist
		if (!usr) {
			System.err.println('\t              > cannot find user');
			res.status(500).send('0');
			return;
		}
		
		// Check if they have the course
		var found = false, n = usr.courses.length, newCourses = [];
		for (var i = 0; i < n; i ++) {
			var c = usr.courses[i];
			if (c.term == term && c.subject == subject && c.code == code) {
				found = true;
			} else {
				newCourses.push(c);
			}
		}
		if (!found) {
			System.err.println('\t              > user does not have ' + subject + ' ' + code);
			res.send('0'); // no update
			return;
		}
		
		// Update the user
		User.update({sid: id}, {courses: newCourses}, {multi: false},
		function(err, numAffected) {
			
			// Error updating
			if (err || numAffected.nModified != 1) {
				System.err.println('\t              > DB COURSE UPDATE FAILED');
				res.send('0');
			} else {
				System.out.println('\t              > removed ' + subject +
					' ' + code + ' from a user', System.FG['bright-green']);
				res.send('1');
			}
		});
	});
}

/**
 * Sets the term for the user to use.
 *
 *	req		the HTTP request.
 *	res		the HTTP response.
 *	term	the term (e.g. 201801).
 *	id		the user ID to update.
 */
function setTerm(req, res, term, id) {
	
	// Check if the user exists
	System.out.println('\t              > updating user\'s term to "' + term + '"',
		System.FG['bright-green']);
	userExists(id, function(usr) {
		
		// User does not exist
		if (!usr) {
			System.err.println('\t              > cannot find user');
			res.status(500).send('0');
			return;
		}
		
		// Get the terms
		webParser.getTerms(function(terms) {
			
			// Check if the term exists
			var index = terms? terms.indexOf(term) : -1;
			
			// Does not exist
			if (index < 0) {
				System.err.println('\t              > could not find term "' + term + '"');
				res.status(400).send('0');
			}
			
			// Term does exist
			else {
				
				// No need to update database
				if (term == usr.term) {
					System.out.println('\t              > no change in user\'s term',
						System.FG['bright-green']);
					res.send('1');
					return;
				}
				
				// Update the term in the database
				User.update({sid: id}, {term: term}, {multi: false},
				function(err, numAffected) {
					
					// Error updating
					if (err || numAffected.nModified != 1) {
						System.err.println('\t              > DB TERM UPDATE FAILED');
						res.send('0');
					} else {
						System.out.println('\t              > DB UPDATED TERM',
							System.FG['bright-green']);
						res.send('1');
					}
				});
			}
		});
	});
}

/**
 * Gets the section info matching the specified search.
 *
 *	req		the HTTP request.
 *	res		the HTTP response.
 *	term	the term (e.g. 201801).
 *	subject	the course subject (e.g. CSCI).
 *	code	the course code (e.g. 1061U).
 */
function getSections(req, res, term, subject, code) {
	
	// Remove sections that are past the cache age
	var oldest = new Date((new Date()).valueOf() - MAX_SECTION_AGE_MS);
	Section.remove({lastUpdated: {$lt: oldest}}, function(err) {
		
		// Handle the deletion result
		if (err) {
			System.err.println('DB ERROR: could not delete old sections');
		}
		
		// Check if there are already sections matching the criteria
		Section.find({term: term, subject: subject, code: code}).then(function(results) {
			
			// Results found
			if (results.length > 0) {
				sendJSON(req, res, results);
				System.out.println('\t              > sending cached sections for ' +
					subject + ' ' + code + ', for ' + term, System.FG['bright-green']);
			}
			
			// No sections found, try searching
			else {
				System.out.println('\t              > searching for ' +
					subject + ' ' + code + ', for ' + term, System.FG['bright-green']);
				getNewSections(req, res, term, subject, code);
			}
		});
	});
	
}

/**
 * Gets the section info matching the specified search, which were not
 * contained in the database.
 *
 *	req		the HTTP request.
 *	res		the HTTP response.
 *	term	the term (e.g. 201801).
 *	subject	the course subject (e.g. CSCI).
 *	code	the course code (e.g. 1061U).
 */
function getNewSections(req, res, term, subject, code) {
	
	// Make a request to the web parser
	webParser.getSections(term, subject, code, function(sections) {
		
		// No sections found
		if (!sections || sections.length == 0) {
			System.err.println('\t              > cannot find ' + subject + ' ' +
				code + ' for term ' + term);
			sendJSON(req, res, []);
			return false;
		}
		
		// Send the sections back to the user
		sendJSON(req, res, sections);
		var n = sections.length;
		System.out.println('\t              > found ' + n + ' sections for ' +
			subject + ' ' + code + ', for ' + term, System.FG['bright-green']);
		
		// Add the sections to the database
		System.out.println('DB: inserting sections...',
			System.FG['bright-yellow']);
		var errCount = 0;
		for (var i = 0; i < n - 1; i ++) {
			var s = sections[i];
			Section.update({crn: s.crn}, s, {upsert: true}, function(err) {
				if (err) {
					System.err.println('DB ERROR: could not insert section, ' + err);
					errCount ++;
				}
			});
		}
		Section.update({crn: sections[n-1].crn}, sections[n-1], {upsert: true}, function(err) {
			if (err) {
				System.err.println('DB ERROR: could not insert section, ' + err);
				errCount ++;
			}
			
			// If error, delete any that got inserted
			if (errCount > 0) {
				for (var i = 0; i < n; i ++) {
					Section.remove(sections[i], function(err) {});
				}
			}
		});
		System.out.println('DB: done inserting new sections',
			System.FG['bright-yellow']);
	});
}

/**
 * Sets the state of a section for a user.
 *
 *	req			the HTTP request.
 *	res			the HTTP response.
 *	term		the term (e.g. 201801).
 *	selected	the selected state of the section.
 *	id			the user ID to update.
 */
function setSectionSelected(req, res, term, crn, selected, id) {
	
	// Check if the user exists
	userExists(id, function(usr) {
		
		// User does not exist
		if (!usr) {
			System.err.println('\t              > cannot find user');
			res.status(500).send('0');
			return;
		}
		
		// Check if the section is already selected
		var n = usr.sections.length, done = false, newSections = [];
		for (var i = 0; i < n; i ++) {
			var s = usr.sections[i];
			if (s.crn == crn && s.term == term) {
				if (selected) {
					done = true;
					break;
				}
			} else {
				newSections.push(s);
			}
		}
		if (selected) {
			newSections.push({term: term, crn: crn});
		}
		if (done || newSections.length == n) {
			System.out.println('\t              > ' + (selected? '' : 'de') +
				'selected ' + crn + ' from a user', System.FG['bright-green']);
			res.send('1');
			return;
		}
		
		// Update the user
		User.update({sid: id}, {sections: newSections}, {multi: false},
		function(err, numAffected) {
			
			// Error updating
			if (err || numAffected.nModified != 1) {
				System.err.println('\t              > DB SECTION SELECT UPDATE FAILED' + (err? ': ' + err : ''));
				res.send('0');
			} else {
				System.out.println('\t              > ' + (selected? '' : 'de') +
					'selected ' + crn + ' from a user', System.FG['bright-green']);
				res.send('1');
			}
		});
	});
}

/**
 * Breaks sections down into their unique courses.
 *
 *	sections	the array of sections.
 */
function getCourses(sections) {
	
	// Split into courses
	var courses = [], n = sections && sections.length? sections.length : 0;
	for (var i = 0; i < n; i ++) {
		var m = courses.length, s = sections[i], added = false;
		for (var j = 0; j < m; j ++) {
			var c = courses[j][0];
			if (c.term == s.term && c.subject == s.subject && c.code == s.code) {
				added = true;
				courses[j].push(s);
			}
		}
		if (!added) {
			courses.push([s]);
		}
	}
	
	return courses;
}

// Export the necessary functions
module.exports.setSession = setSession;
module.exports.getSession = getSession;
module.exports.genID = genID;
module.exports.userExists = userExists;
module.exports.getInfo = getInfo;
module.exports.addCourse = addCourse;
module.exports.removeCourse = removeCourse;
module.exports.setTerm = setTerm;
module.exports.getSections = getSections;
module.exports.setSectionSelected = setSectionSelected;
module.exports.sendJSON = sendJSON;
