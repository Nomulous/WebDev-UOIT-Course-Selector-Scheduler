/* Name: programs.js
 * Author: Devon McGrath
 * Description: This script contains functions for the programs.html page.
 */

var progs = [];
var courses = [];

/** Gets the list of programs available. */
function getPrograms() {
	getData('/get-programs', function(txt) {
		if (!txt) {txt = '';}
		while (txt.length > 0 && txt.charAt(txt.length - 1) == '\n') {
			txt = txt.substr(0, txt.length - 1);
		}
		progs = txt.split('\n');
	});
}

/** Determines the relevant search results to show. */
function updateSearch() {
	
	var txt = document.getElementById('program').value;
	var res = document.getElementById('program-result');
	res.innerHTML = '';
	
	// No text to match
	if (txt.length == 0) {return -1;}
	
	// Get a match (or close match)
	var html = '', n = progs.length, match = -1, show = 0, LIMIT = 5;
	for (var i = 0; i < n && show < LIMIT; i ++) {
		var p = progs[i];
		if (p.toLowerCase() == txt.toLowerCase()) {
			match = i;
			html = '';
			break;
		}
		if (p.search(new RegExp(txt, 'i')) >= 0) {
			html += '<div class="result" onclick="setResult(' + i + ');">' + p + '</div>\n';
			show ++;
		}
	}
	res.innerHTML = html;
	if (match >= 0) {
		setResult(match);
	}
	
	return match;
}

/**
 * Updates the text input to display the program at index 'result'. Then, sends
 * an HTTP request to the server to get the program details.
 *	result	the index of the program to get.
 */
function setResult(result) {
	if (result < 0 || result >= progs.length) {return;}
	
	// Update the text field and results
	document.getElementById('program').value = progs[result];
	document.getElementById('program-result').innerHTML = '';
	
	// Send the request
	getData('/get-programs?' + result, function(txt) {
		if (!txt) {txt = '';}
		var html = '';

		// Create the HTML
		var lines = txt.split('\n'), n = lines.length, exp = /^[a-z]{3,4} [0-9]{4}[a-z]/i;
		var anti = /(elective.+requirement| credit hour|[a-z]{3,4} [0-9]{4}[a-z]$)/i
		courses = [];
		for (var i = 0; i < n; i ++) {
			var l = lines[i];
			if (!l.startsWith('<')) {
				var m = l.match(exp), s = l.startsWith('Semester');
				if (anti.test(l) && !s) {continue;}
				if (m) {
					l = '<td id="courses-c' + courses.length + '" onclick="' +
						'updateSelected('+courses.length+');" class="course">'+l+'</td>';
					courses.push({"name": m, "selected": false});
				} else if (s) {
					l = '<td class="semester">' + l + '</td>';
				} else {
					l = '<td class="course-info">' + l + '</td>';
				}
			}
			html = html + '<tr>' + l + '</tr>\n';
		}
		
		document.getElementById('courses').innerHTML = html;
	});
}

/**
 * Sets the selected state of a course.
 *	selected	true to select the course, false otherwise.
 *	courseIndex	the index of the course to update.
 */
function setSelected(selected, courseIndex) {
	if (!courses || courseIndex < 0 || courseIndex >= courses.length) {
		return;
	}
	courses[courseIndex].selected = selected;
	var td = document.getElementById('courses-c' + courseIndex);
	if (td) {
		td.setAttribute('style', selected? 'background-color: #CFCFFF;' : '');
	}
	updateAdded();
}

/**
 * Selects the course index specified, if not selected. If the course is
 * selected, it's selection will be cleared.
 * 	courseIndex	the index of the course to update.
 */
function updateSelected(courseIndex) {
	if (!courses || courseIndex < 0 || courseIndex >= courses.length) {
		return;
	}
	setSelected(!courses[courseIndex].selected, courseIndex);
}

/** Updates the 'added' div to show the complete list of selected courses. */
function updateAdded() {
	
	var added = '', n = courses? courses.length : 0;
	for (var i = 0; i < n; i ++) {
		if (courses[i].selected) {
			added += '<span class="btn-simple" onclick="setSelected(false, '+
				i + ')" title="Remove selection">' + courses[i].name + '</span>';
		}
	}
	document.getElementById('added').innerHTML = (added.length > 0? 'Selected Courses: ' : '') + added;
}

/** Clears the selected courses. */
function clearSelection() {
	var n = courses? courses.length : 0;
	for (var i = 0; i < n; i ++) {
		setSelected(false, i);
	}
}

/** Adds all the selected courses to the current term. */
function addCourses() {
	
	// Get the selected courses
	var n = courses? courses.length : 0, added = [];
	for (var i = 0; i < n; i ++) {
		if (courses[i].selected) {
			var parts = courses[i].name[0]? courses[i].name[0].split(' ') : ['', ''];
			var subject = parts[0];
			var code = parts[1];
			added.push({subject: subject, code: code});
		}
	}
	n = added.length;
	
	// Setup the message HTML
	var msg = $('#added-messages');
	var html = '';
	for (var i = 0; i < n; i ++) {
		html += '<p class="status grey">' + added[i].subject + ' ' + added[i].code + ': waiting...</p>';
	}
	msg.html(html);
	
	// Add the courses
	var statuses = $('#added-messages .status');
	for (var i = 0; i < n; i ++) {
		addCourse(user.term, added[i].subject, added[i].code, function(data, err, term, subject, code) {
			
			// Remove the waiting
			var j = 0, message = subject + ' ' + code + ': ';
			for (; j < n; j ++) {
				if (statuses[j].innerHTML.indexOf(message) >= 0) {
					break;
				}
			}
			if (j < 0 || j >= n) {return;}
			var s = $(statuses[j]);
			s.removeClass('grey');
			
			// Determine the message
			var colour = 'red';
			if (err || data == '') {
				message += 'server error, try again.';
			} else if (data == '1') {
				colour = 'yellow';
				message += 'you already added this course.';
			} else if (data == '2') {
				message += 'could not find this course for the term specified.';
			} else if (data == '3') {
				message += 'multiple course matches were found.';
			} else if (data.indexOf('\t') >= 0) {
				colour = 'green';
				message += 'course added successfully.';
			} else {
				message += 'error adding course.';
			}
			
			// Update the status
			s.addClass(colour);
			s.html(message);
		});
	}
}

getPrograms();