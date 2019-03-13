/* Name: core.js
 * Author: Devon McGrath and Martin Tuzim
 * Description: This script contains functions commonly used in the web application.
 */

var USER_URI = '/user', user = null, pageStatus = 0;
var updateListeners = {setTerm: [], addCourse: [], removeCourse: [], getSections: []};

function User(data, term, courses) {
	this.data = data;
	this.term = term;
	this.courses = courses;
	
	/** Updates the HTML to tell the user the current term and courses they
	 *  selected. */
	this.updateInfo = function() {
		
		// Create the HTML to display to the user
		var t = this.term;
		var html = '';
		var c = this.courses? this.courses : [], n = c.length? c.length : 0;
		var added = 0;
		for (var i = 0; i < n; i ++) {
			if (c[i].term != t) {continue;}
			var course = c[i].subject + ' ' + c[i].code;
			html += '<span class="btn-simple" onclick="removeCourse(\'' + c[i].term +
				'\', \'' + c[i].subject + '\', \'' + c[i].code + '\');"' +
				' title="Remove course">' + course + '</span>';
			added ++;
		}
		if (added == 0) {
			html += 'None';
		}
		$('#user-info').css('display', 'block');
		$('.banner-courses').html(html);
		
		// Set the selected term
		$('.banner-terms select').val(t);
	}
}

/** Downloads data in the specified file. */
function download(filename, data) {
	var elem = document.createElement('a');
	elem.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(data));
	elem.setAttribute('download', filename);

	elem.style.display = 'none';
	document.body.appendChild(elem);

	elem.click();

	document.body.removeChild(elem);
}

/** Logs an error message. */
function log(msg) {
	console.error('UOIT COURSE SCHEDULER: ' + msg);
}
 
/** Generates an HTTP request to get extra content. */
function getData(path, responseFunction) {
	var xhttp = window.XMLHttpRequest? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	xhttp.onreadystatechange = function() {
		if (this.readyState == 4 && (this.status == 200 || this.status == 0)) {
			responseFunction(this.responseText);
		}
	};
	xhttp.open("GET", path, true);
	xhttp.send();
}

/** Posts data to the specified path. */
function postData(url, data, callback) {
	
	// Make the POST request
	$.ajax({
		type: 'POST',
		url: url,
		data: data,
		success: function(data) {
			callback(data, false);
		}, error: function(xhr) {
			callback(xhr.responseText, true);
		}
	});
}

/** Removes a course that the user has selected. */
function removeCourse(term, subject, code, callback) {
	
	// Encode the fields
	var name = subject + ' ' + code;
	term = term? encodeURIComponent(term) : '';
	subject = subject? encodeURIComponent(subject) : '';
	code = code? encodeURIComponent(code) : '';
	
	// Tell the server to remove the course
	postData(USER_URI, 'cmd=REMCOURSE&term=' + term + '&subject=' + subject + '&code=' + code,
	function(data, err) {
		
		// There was some error
		if (err) {
			log('Could not remove course ' + name);
		}
		
		// The course was removed
		else if (data == '1') {
			var newCourses = [], n = user.courses? user.courses.length : 0;
			for (var i = 0; i < n; i ++) {
				var current = user.courses[i].subject + ' ' + user.courses[i].code;
				if (name != current) {
					newCourses.push(user.courses[i]);
				}
			}
			user.courses = newCourses;
			user.updateInfo();
		}
		
		// Call the callback
		if (callback) {
			callback(data, err);
		}
		
		// Call the listeners
		var listeners = updateListeners.removeCourse;
		if (listeners) {
			var count = listeners.length? listeners.length : 0;
			for (var i = 0; i < count; i ++) {
				if (listeners[i]) {
					listeners[i](data, err);
				}
			}
		}
	});
}

/** Adds a course to the user's selection. */
function addCourse(term, subject, code, callback) {
	
	// Encode the fields
	term = term? encodeURIComponent(term) : '';
	subject = subject? encodeURIComponent(subject) : '';
	code = code? encodeURIComponent(code) : '';
	
	// Tell the server to add the course
	postData(USER_URI, 'cmd=ADDCOURSE&term=' + term + '&subject=' + subject + '&code=' + code,
	function(data, err) {
		
		// Add course
		if (!err && data && data.indexOf('\t') >= 0) {
			var info = data.split('\t');
			term = info[0];
			subject = info[1];
			code = info[2];
			var course = {term: term, subject: subject, code: code};
			user.courses.push(course);
			user.updateInfo();
		}
		
		// Print an error
		else if (err) {
			log('could not add "' + name + '" for term "' + term +
				'". Server responded with "' + data + '"');
		}
		
		// Call the callback
		if (callback) {
			callback(data, err, term, subject, code);
		}
		
		// Call the listeners
		var listeners = updateListeners.addCourse;
		if (listeners) {
			var count = listeners.length? listeners.length : 0;
			for (var i = 0; i < count; i ++) {
				if (listeners[i]) {
					listeners[i](data, err, term, subject, code);
				}
			}
		}
	});
}

/** Gets section information. */
function getSections(term, subject, code, callback) {
	
	// Encode the fields
	term = term? encodeURIComponent(term) : '';
	subject = subject? encodeURIComponent(subject) : '';
	code = code? encodeURIComponent(code) : '';
	
	// Get the sections
	postData(USER_URI, 'cmd=GETSECTIONS&term=' + term +
		'&subject=' + subject + '&code=' + code, callback);
	
	// Call the listeners
	var listeners = updateListeners.getSections;
	if (listeners) {
		var count = listeners.length? listeners.length : 0;
		for (var i = 0; i < count; i ++) {
			if (listeners[i]) {
				listeners[i](data, err);
			}
		}
	}
}

/** Sets the term the user is viewing. */
function setTerm(term, callback) {
	
	// Encode the term
	term = term? encodeURIComponent(term) : '';
	
	// Tell the server to update the term
	postData(USER_URI, 'cmd=SETTERM&term=' + term,
	function(data, err) {
		
		// Update term
		if (!err && data == '1') {
			user.term = term;
			user.updateInfo();
		}
		
		// Print an error
		else if (err) {
			log('could not set term to "' + term + '"');
		}
		
		// Call the callback
		if (callback) {
			callback(data, err);
		}
		
		// Call the listeners
		var listeners = updateListeners.setTerm;
		if (listeners) {
			var count = listeners.length? listeners.length : 0;
			for (var i = 0; i < count; i ++) {
				if (listeners[i]) {
					listeners[i](data, err);
				}
			}
		}
	});
}

/** Sets the selected state of a section. */
function setSectionSelected(term, crn, selected, callback) {
	
	// Encode the fields
	term = term? encodeURIComponent(term) : '';
	crn = crn? encodeURIComponent(crn) : '';
	selected = selected? '1' : '';
	
	// Tell the server to update the state
	postData(USER_URI, 'cmd=SELECTSECTION&term=' + term + '&crn=' + crn +
		'&state=' + selected, function(data, err) {
		
		// Log an error
		if (err || data == '0') {
			log('failed to set section state for ' + crn +
				' in term ' + term + ' to ' + selected);
		}
		
		// Call the callback
		if (callback) {
			callback(data, err, term, crn, selected);
		}
	});
}

/** Set up the page. */
$(document).ready(function() {
	
	// Get the user info
	postData(USER_URI, 'cmd=GETINFO', function(data, err) {
		
		// Some error occurred
		if (err) {
			user = new User('Unavailable');
			user.updateInfo();
			pageStatus = 2;
			return;
		}
		
		// Create the user
		if (!data.courses) {data.courses = []};
		user = new User(data, data.term, data.courses);
		user.updateInfo();
		
		// Set the page status to 2 after the user data has loaded
		pageStatus = 2;
	});
	
	// Add a listener to update the term
	$('.banner-terms select').change(function() {
		$('.banner-terms select').val(this.value);
		setTerm(this.value);
	});
	
	pageStatus = 1;
});

/* --------------- LISTENERS --------------- */
/** Adds a listener to setTerm which is called with the status. */
function addSetTermListener(callback) {
	if (callback) {
		updateListeners.setTerm.push(callback);
	}
}

/** Adds a listener to addCourse which is called with the status. */
function addAddCourseListener(callback) {
	if (callback) {
		updateListeners.addCourse.push(callback);
	}
}

/** Adds a listener to removeCourse which is called with the status. */
function addRemoveCourseListener(callback) {
	if (callback) {
		updateListeners.removeCourse.push(callback);
	}
}

/** Adds a listener to getSections which is called with section data. */
function addGetSectionsListener(callback) {
	if (callback) {
		updateListeners.getSections.push(callback);
	}
}
