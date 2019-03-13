jQuery(document).ready(function($){
	
    // Variables used within select courses
    var usercourses = $("#usercourses");
    var addcourses = $("#useraddcourses");
    var table = $("#selectedcourses");
    var results = $("#added-messages");


    // ============= Functions ===============

    // Convert the number semester into a legible value
    function convertSemeseter(input) {
        year = input.slice(0, 4);
        semester = (input.slice(4) == '01') ? "Winter" : (input.slice(4) == '05') ? "Summer" : "Fall";
        return semester + " " + year;
    }


    // Refresh the select-courses table by removing old values and repopulating it
    function refreshTable() {
        $("#selectedcourses > tbody > tr").remove();
		$.each(user.courses, function(count, course) {
			var term = course.term, subject = course.subject, code = course.code;
			table.append('<tr><td>' + convertSemeseter(term) + '</td><td>' +
				subject + '</td><td>' + code + '</td><td><button class="btn" ' +
				'onclick="removeCourse(\'' + term + '\', \'' + subject + '\', \'' +
				code + '\')">Delete!</button></td></tr>');
		});
    }


    // ============= Waiting for JavaScript to Load ==========

    //Wait 2 seconds for javascript to load and once that is loaded
    // the user object is accessible
    setTimeout(function() {
        refreshTable();
    }, 2000);

    // Add a listener for add/remove course so the table is updated
	addAddCourseListener(refreshTable);
    addRemoveCourseListener(refreshTable);

	// Add a course as per user input
    $("#submit").click(function() {
		
        //Get values on Submit
		var msg = $('#added-messages');
		msg.html('');
        var subject = $("#subject option:selected").val();
        var code = $("#code").val();
        $("#code").val('');

        // Test that the code is only numbers
        var pattern = /[0-9]{0,4}[a-z]?$/gi;
        if(code.search(pattern) == 0) {
			
			msg.html('<p class="status grey">' + subject + ' ' + code + ': waiting...</p>');
			
			// Add the course
            addCourse(user.term, subject, code, function(data, err, term, subject, code) {
			
				// Remove the waiting
				var s = $('#added-messages p');
				var message = subject + ' ' + code + ': ';
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
        } else { // pattern not matched
            msg.html('<p class="status red">Code "' + code + '" is not a valid code.</p>');
        }
    });
});

// Add a listener so that when enter is pressed, the user input is submitted
$(document).keypress(function(e) {
    if(e.which == 13) {
        $('#submit').trigger('click');
    }
});
