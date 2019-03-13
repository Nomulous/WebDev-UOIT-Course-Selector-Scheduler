/* Name: server.js
 * Author: Devon McGrath
 * Description: This is the main JS file for the node server. It starts the
 * back-end server for the CSCI 3230U final project.
 */

// Modules
var express = require('express');
var bodyParser = require('body-parser');
var webParser = require('./web-parser');
var session = require('./session');
var System = require('./utils');

// Constants
const PORT = process.env.PORT || 8080;

// Middleware
var app = express();
app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

// Configure view engine
app.set('views', __dirname + '/views');
app.set('view engine', 'pug');

var terms = [];
webParser.getTerms(function(result) {
	terms = [];
	var n = result? result.length : 0;
	for (var i = 0; i < n && i < 3; i ++) {
		terms.push(result[i]);
	}
	startServer();
});

// Starts the server
function startServer() {
	
	// Start listening
	app.listen(PORT, function() {
		System.out.println('Node server listening on port: ' + PORT, System.FG['bright-magenta']);
	});
	
}

/* ----------------------------- BEGIN ROUTES ----------------------------- */
app.use(function(req, res, next) {
	var now = new Date();
	
	// Print some logging info
	System.out.println(now.toLocaleString() + ':', System.FG['bright-magenta']);
	System.out.println('\tremote address: "' + req.connection.remoteAddress + '"',
		System.FG['bright-cyan']);
	System.out.println('\t   request for: "' + req.url + '"',
		System.FG['bright-cyan']);
	
	next();
});

// >>>>>>>>>>>>>>>>>>>>>>>> PAGES

// Home page
app.get('/', function(req, res) {
	res.render('index', {'title': 'UOIT Course Scheduler', 'terms': terms});
});

// Select Courses page
app.get('/select-courses', function(req, res) {
	res.render('select-courses', {'title': 'Select Courses', 'terms': terms});
});

// Schedule Creator page
app.get('/schedule-creator', function(req, res) {
	res.render('schedule-creator', {'title': 'Schedule Creator', 'terms': terms});
});

// Program Browser page
app.get('/programs', function(req, res) {
	res.render('programs', {'title': 'Program Browser', 'terms': terms});
});

// >>>>>>>>>>>>>>>>>>>>>>>> AJAX REQUESTS

// For getting the terms available
app.get('/get-terms', function(req, res) {
	webParser.getTerms(function(terms) {
		
		// Create the response
		var txt = '', n = terms? terms.length : 0;
		for (var i = 0; i < n; i ++) {
			txt += terms[i] + '\t';
		}
		if (txt.length > 0) {
			txt = txt.substr(0, txt.length - 1);
		}
		
		// Send it
		res.send(txt);
	});
});

// For getting available programs (e.g. Computer Science)
app.get('/get-programs', function(req, res) {
	webParser.getPrograms(req, res);
});

// For getting/setting user info
app.post('/user', function(req, res) {
	
	// Get the user ID
	var id = session.getSession(req, res);
	if (id == '') {
		
		// Generate a new user ID
		System.out.println('Creating new user...', System.FG['bright-yellow']);
		id = session.genID();
		session.setSession(req, res, id);
		System.out.println('Done.', System.FG['bright-yellow']);
		
		// Handle the actual command
		handleUserCmd(req, res, id);
	}
	
	// Check the database
	else {
		session.userExists(id, function(exists) {
			
			// Generate a new user ID if the user doesn't exist
			if (!exists) {
				System.out.println('Creating new user...', System.FG['bright-yellow']);
				id = session.genID(function(id, err) {
					session.setSession(req, res, id);
					System.out.println('Done.', System.FG['bright-yellow']);
					
					// Handle the actual command
					handleUserCmd(req, res, id);
				});
			} else {
			
				// Handle the actual command
				handleUserCmd(req, res, id);
			}
		});
	}
});

/**
 * Handles a user command.
 */
function handleUserCmd(req, res, id) {
	
	// Get common fields
	var cmd = req.body.cmd;
	var term = req.body.term;
	var subject = req.body.subject;
	var code = req.body.code;
	
	System.out.println('\t       command: "' + cmd + '"', System.FG['bright-cyan']);
	
	// Clean relevant inputs
	if (term) { // only numbers are allowed in the term (e.g. 201701)
		term = term.replace(/[^0-9]/gi, '');
	} if (subject) { // only a-z characters are allowed in the subject
		subject = subject.replace(/[^a-z]/gi, '');
	} if (code) { // only letters and numbers allowed in the code (e.g. 1000U)
		code = code.replace(/[^a-z0-9]/gi, '');
	}
	
	// Get user info
	if (cmd == 'GETINFO') {
		session.getInfo(id, function(info) {
			info.sid = '';
			session.sendJSON(req, res, info);
		});
	}
	
	// Remove a course
	else if (cmd == 'REMCOURSE') {
		
		System.out.println('\t              > term="' + term + '", subject="' +
			subject + '", code="' + code + '"', System.FG['bright-green']);
		
		// Get the session to handle the request
		session.removeCourse(req, res, term, subject, code, id);
	}
	
	// Add a course
	else if (cmd == 'ADDCOURSE') {
		
		System.out.println('\t              > term="' + term + '", subject="' +
			subject + '", code="' + code + '"', System.FG['bright-green']);
	
		// Get the session to handle the request
		session.addCourse(req, res, term, subject, code, id);
	}
	
	// Set term
	else if (cmd == 'SETTERM') {
		
		// Get the session to handle the request
		session.setTerm(req, res, term, id);
	}
	
	// Get sections
	else if (cmd == 'GETSECTIONS') {
		
		// Get the session to handle the request
		session.getSections(req, res, term, subject, code);
	}
	
	// Select section
	else if (cmd == 'SELECTSECTION') {
		
		// Perform input cleaning
		var crn = req.body.crn;
		var state = req.body.state? true : false;
		if (crn) { // only numbers are allowed in the CRN
			crn = crn.replace(/[^0-9]/gi, '');
		}
		System.out.println('\t              > term="' + term + '", CRN="' + crn + '"',
			System.FG['bright-green']);
		
		// Get the session to handle the request
		session.setSectionSelected(req, res, term,
			crn, req.body.state, id);
	}
	
	// 400 Bad Request: Not sure what to do
	else {
		res.status(400).send('undefined');
	}
}

// >>>>>>>>>>>>>>>>>>>>>>>> ERROR PAGES

// 404 Error handling
app.use(function(req, res) {
	res.status(404);
	res.render('error-404', {'title': 'Page not found! | UOIT Course Scheduler', 'terms': terms});
});

/* ----------------------------- END ROUTES ----------------------------- */
