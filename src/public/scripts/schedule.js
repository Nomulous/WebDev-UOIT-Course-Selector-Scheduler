jQuery(document).ready(function($){
	//Variables needed for the project

	//Dropdown Menu Variables
	var dropdown = $("#dropdown");				//The Dropdown Div Object
	var dropdownhtml = dropdown.html();			//Current HTML To store
	var courseColours = {};						//Course Colours, based on "coursetime":n, where n is a number from 1-x 
	var inSchedule = {};						//Keeping track of which courses are in the schedule to remove them if selected again
	var uniqueData = [];

	//Global variables for time slot blocks
    var timeLineStart = 0;
    var EventSlotHeight = 0;
    var TimeLineUnitDuration = 0;


	// =======================================================================================================================================================
	// This code is utilized and heavily modified from to get the basic idea of a schedule. The addition of events
	//     and dynamic allocations are not seen within the source while they are added here to ensure functionality
	//	   works for our project.
	// Source: https://github.com/CodyHouse/schedule-template
	function SchedulePlan( element ) {
		this.element = element;
		this.timeline = this.element.find('.timeline');
		this.timelineItems = this.timeline.find('li');
		this.timelineItemsNumber = this.timelineItems.length;
        this.timelineStart = getScheduleTimestamp(this.timelineItems.eq(0).text());
        timeLineStart = this.timelineStart;
		//need to store delta (in our case half hour) timestamp
		this.timelineUnitDuration = getScheduleTimestamp(this.timelineItems.eq(1).text()) - getScheduleTimestamp(this.timelineItems.eq(0).text());
        TimeLineUnitDuration = this.timelineUnitDuration;
		this.eventsWrapper = this.element.find('.events');
		this.eventsGroup = this.eventsWrapper.find('.events-group');
		this.singleEvents = this.eventsGroup.find('.single-event');
        this.eventSlotHeight = this.eventsGroup.eq(0).children('.top-info').outerHeight();
        EventSlotHeight = this.eventSlotHeight;
		this.modal = this.element.find('.event-modal');
		this.modalHeader = this.modal.find('.header');
		this.modalHeaderBg = this.modal.find('.header-bg');
		this.modalBody = this.modal.find('.body'); 
		this.modalBodyBg = this.modal.find('.body-bg'); 
		this.modalMaxWidth = 800;
		this.modalMaxHeight = 480;
		this.animating = false;
    }
	var schedules = $('.cd-schedule');
	var objSchedulesPlan = []; 
	if( schedules.length > 0 ) {
		schedules.each(function(){
			//create SchedulePlan objects
			objSchedulesPlan.push(new SchedulePlan($(this)));
		});
	}
	
	function getScheduleTimestamp(time) {
		//accepts hh:mm format - convert hh:mm to timestamp
		time = time.replace(/ /g,'');
		var timeArray = time.split(':');
		var timeStamp = parseInt(timeArray[0])*60 + parseInt(timeArray[1]);
		return timeStamp;
	}
	// =======================================================================================================================================================




	// Dynamic adding of events 
	// Params:
	// day 			= Monday,Tuesday,Wednesday,Thursday,Friday
	// starttime 	= hh:mm
	// endtime		= hh:mm
	// msg			= Message to fill in the box
	// type			= Colour type, from 1 - n, current n is 5 as this is found in css
    function addEvent(day, starttime, endtime, msg, type) {
		//Add the event into inSchedule to keep track of the event

		//Variables For The Course
		sTimeHour = starttime.split(":")[0];
		sTimeMin = starttime.split(":")[1];
		if (msg.split("<br />")[0].split(" ").length == 2) {
			CourseCode = msg.split("<br />")[0].split(" ")[0];
			CourseType = msg.split("<br />")[0].split(" ")[1];
		} else {
			CourseCode = msg.split("<br />")[0].split(" ")[1];
			CourseType = msg.split("<br />")[0].split(" ")[2];
		}

		divName = day + sTimeHour + sTimeMin + CourseCode + CourseType;

		inSchedule[divName] = 1;

		//Get the li from the html to add events to it
		var currentString = $("#" + day).html();

		// Convert the start time to a timestamp and get the duration, needed to find the length of the box
		var start = getScheduleTimestamp(starttime),
			duration = getScheduleTimestamp(endtime) - start;

		// Calculate pixel lengths of where to start and how tall the box is
		var top = EventSlotHeight * (start - timeLineStart) / TimeLineUnitDuration,
			height = EventSlotHeight * duration / TimeLineUnitDuration;

		//Add the box events
		//	Format is											v Colour      v Size of box
		//	<li id="start-end" class="single-event" data-event="event-n" style="top: px; height: px">
		//		<a href="#0">
		//			<span class="event-date">The time in the top of the box</span>
		//			<em class="event-name"> Text Inside Box</em>
		//		</a>
		//	</li>
		currentString += '<li id="' + divName + '" class="single-event" data-event="event-' + type + '"';
		currentString += ' style="top: ' + (top - 1) + 'px; height: ' + (height - 1) + 'px;">';
		currentString += '<a href="#0"><span class="event-date">' + starttime + ' - ' + endtime + '</span>';
		currentString += '<em class="event-name">' + msg + '</em></a></li>';

		//Append to the list
		$("#" + day).html(currentString); 
    }


	//Function to convert minutes to hh:mm as the values are scraped in minutes
	function convertTohhmm(minutes) {
		var hours = ''+Math.floor(minutes / 60);
		if (hours.length == 1) {
			hours = '0' + hours;
		}
		var minutes = '' + (minutes % 60);
		if (minutes.length == 1) {
			minutes = '0' + minutes;
		}
		return (hours + ":" + minutes);
	}


	addSetTermListener(function(data, err) {
		clearTable();
		$(".course").remove();
		dropdown.html("");
		dropdownhtml = "";
		//console.log("aaaaa");
		loadCourses();
	});

	function loadCourses() {
		usercourses = user.courses;
		dropdownhtml = "<h2>Select your courses here!</h2><hr>";
		$.each(usercourses, function(count, course) {
			if (course.term == user.term) {
				//Make divs for each lecture/lab/tutorial to attach to.
				courseColours[course["code"]] = count + 1;
				dropdownhtml += '<div class="course">';
				dropdownhtml += "Course: " + course["subject"] + course["code"];
				dropdownhtml += '   Lecture: <select id="' + course["subject"] + course["code"] + 'lecture"></select>';
				dropdownhtml += '   Laboratory: <select id="' + course["subject"] + course["code"] + 'laboratory"></select>';
				dropdownhtml += '   Tutorial: <select id="' + course["subject"] + course["code"] + 'tutorial"></select>';
				dropdownhtml += "</div>";
				dropdownhtml += "<hr>";
				count++;
			}

		});
		dropdown.html(dropdownhtml);


		//Fill in each lecture/lab/tutorial
		$.each(usercourses, function(count, course) {
			if (course.term == user.term) {
				getSections(course["term"], course["subject"], course["code"], function(data, err) {
					//Get each HTML Object to append to
					var lecture = $("#" + course["subject"] + course["code"] + 'lecture');
					var laboratory = $("#" + course["subject"] + course["code"] + 'laboratory');
					var tutorial = $("#" + course["subject"] + course["code"] + 'tutorial');

					//Append Empty Objects to allow first item to be selected
					lecture.append('<option value="' + course["code"] + 'Lecture"> </option>');
					laboratory.append('<option value="' + course["code"] + 'Laboratory"> </option>');
					tutorial.append('<option value	="' + course["code"] + 'Lecture"> </option>');

					var uniqueTimes = [];
					uniqueData = [];
					//uniqueData = [];

					for(i = 0; i < data.length; i++) {
						day = data[i].times[0].day;
						start = data[i].times[0].start;
						if(uniqueTimes.indexOf(day + start) === -1) {
							uniqueTimes.push(day + start);
							uniqueData.push(data[i]);
						}
					}
					

					//Load User Preloaded Courses
					$.each(user.data.sections, function(userkey, uservalue) {
						$.each(uniqueData, function(uKey, uVal) {
							if(uservalue.crn == uVal.crn) {
								if(uVal.times[0].scheduleType == "Lecture") {
									$.each(uVal.times, function(k, v) {
										day = v.day;
										switch (day) {
											case "M":
												day = "monday";
												break;
											case "T":
												day = "tuesday";
												break;
											case "W":
												day = "wednesday";
												break;
											case "R":
												day = "thursday";
												break;
											case "F":
												day = "friday";
												break;
										}
										starttime = convertTohhmm(v.start);
										endtime = convertTohhmm(v.end);
										CourseType = v.scheduleType;
										crn = uVal.crn;
										code = uVal.code;
										subject = uVal.subject;
										addEvent(day, starttime, endtime, subject + " " + code + " " + CourseType + "<br />CRN:" + crn, courseColours[code]);	
									});
								} else {
									//Lab or
									day = uVal.times[0].day;
									switch (day) {
										case "M":
											day = "monday";
											break;
										case "T":
											day = "tuesday";
											break;
										case "W":
											day = "wednesday";
											break;
										case "R":
											day = "thursday";
											break;
										case "F":
											day = "friday";
											break;
									}
									starttime = convertTohhmm(uVal.times[0].start);
									endtime = convertTohhmm(uVal.times[0].end);
									CourseType = uVal.times[0].scheduleType;
									crn = uVal.crn;
									code = uVal.code;
									sTimeHour = starttime.split(":")[0];
									sTimeMin = starttime.split(":")[1];
									subject = uVal.subject;
						
									divName = day + sTimeHour + sTimeMin + code + CourseType;

									
									$.each(inSchedule, function(data) {
										if(data.indexOf(code + CourseType) >= 0) {
											$("#" + data).remove();
											inSchedule[data] =  0;
											setSectionSelected(user.term, crn, false, function(d) {
												//console.log(d);
											});
										}
									});
									// Check if the
									if (inSchedule[divName] == 1) {
									$("#"+ divName).remove();
										inSchedule[divName] = 0;
										setSectionSelected(user.term, crn, false, function(d) {
										//console.log(d);
									});
									} else {
										addEvent(day, starttime, endtime, subject + " " +code + " " + CourseType + "<br />CRN:" + crn, courseColours[code]);	
										setSectionSelected(user.term, crn, true, function(d) {
											//console.log(d);
										});
									}
									//addEvent(day, starttime, endtime, code + " " + CourseType + "<br />CRN:" + crn, courseColours[code]);	
						
								}
							}
						});
				});





				//Cycle through each "data" that we got from getSections to parse and append to the proper HTML Object
				$.each(uniqueData, function(key, courses) {

					// The way each element is appended is to store each cruicial piece of information in the "Value" which in thise case is COURSE:STARTTIME:ENDTIME
					//		then print it out for the user to select it
					if(courses["times"][0]["scheduleType"] == "Laboratory"){
						laboratory.append('<option value="' + course["code"] + ":" +courses["times"][0]["day"] + ":" + convertTohhmm(courses["times"][0]["start"]) + "-" + convertTohhmm(courses["times"][0]["end"]) + ':Laboratory:'+ courses["crn"] + '">' + courses["times"][0]["day"]+ ":" + convertTohhmm(courses["times"][0]["start"]) + "-" + convertTohhmm(courses["times"][0]["end"]) + "</option>");
					} 
					if(courses["times"][0]["scheduleType"] == "Tutorial"){
						tutorial.append('<option value="' + course["code"] + ":" + courses["times"][0]["day"] + ":" + convertTohhmm(courses["times"][0]["start"]) + "-" + convertTohhmm(courses["times"][0]["end"]) + ':Tutorial:' + courses["crn"] + '">' + courses["times"][0]["day"] + ":" + convertTohhmm(courses["times"][0]["start"]) + "-" + convertTohhmm(courses["times"][0]["end"]) + "</option>");
					} 
					if(courses["times"][0]["scheduleType"] == "Lecture"){
						//Lecture needs to be modified, as there's 2 times commonly per 1 selection
						var times = "";
						$.each(courses["times"], function(amt, time) {
							times += time["day"] + ":" + convertTohhmm(time["start"]) + "-" + convertTohhmm(time["end"]) + ":";
						});
						lecture.append('<option value="' + course["code"] + ":" + times + 'Lecture:' + courses["crn"] + '">' + times + '</option>');
					} 
				});
			});
		}
		});
		
		// A listener on the "select" change
		$('select').on('change', function(e) {
			
			// Since we have an "empty" value intiailized, we need to make sure we work if it doesn't select the empty value
			if(this.value) {
				var valueSelected = this.value.split(":");
				var day;
				

				//Convert number into word
				
				switch (valueSelected[1]) {
					case "M":
						day = "monday";
						break;
					case "T":
						day = "tuesday";
						break;
					case "W":
						day = "wednesday";
						break;
					case "R":
						day = "thursday";
						break;
					case "F":
						day = "friday";
						break;
				}

				var startTime;
				var endTime;
				
				//Lectures have double times, so we add events twice
				if (valueSelected.length > 7) {
					//Parse the Time Values
					startTime = valueSelected[2] + ":" + valueSelected[3].split("-")[0];
					endTime = valueSelected[3].split("-")[1] + ":" + valueSelected[4];

					//Variables For The Course
					sTimeHour = startTime.split(":")[0];
					sTimeMin = startTime.split(":")[1];
					CourseCode = valueSelected[0];
					CourseType = valueSelected[9];

					divName = day + sTimeHour + sTimeMin + CourseCode + CourseType;

					crn = valueSelected[10];
					var subject = "";

					console.log(user.courses);

					$.each(uniqueData, function(key, value) {
						if (value.crn == crn) {
							subject = value.subject;
						}
					});


					// Check if the course exists
					if (inSchedule[divName] == 1) {
						$("#"+ divName).remove();
						inSchedule[divName] = 0;
						setSectionSelected(user.term, crn, false, function(d) {
							//console.log(d);
						});
					} else {
						addEvent(day, startTime, endTime, subject + " " + valueSelected[0] + " " + valueSelected[9] + "<br />CRN:" + valueSelected[10], courseColours[valueSelected[0]]);
						setSectionSelected(user.term, crn, true, function(d) {
							//console.log(d);
						});
					}

					//Second Time Slot
					switch (valueSelected[5]) {
						case "M":
							day = "monday";
							break;
						case "T":
							day = "tuesday";
							break;
						case "W":
							day = "wednesday";
							break;
						case "R":
							day = "thursday";
							break;
						case "F":
							day = "friday";
							break;
					}
					startTime = valueSelected[6] + ":" + valueSelected[7].split("-")[0];
					endTime = valueSelected[7].split("-")[1] + ":" + valueSelected[8];
					
					//Variables For The Course
					sTimeHour = startTime.split(":")[0];
					sTimeMin = startTime.split(":")[1];
					CourseCode = valueSelected[0];
					CourseType = valueSelected[9];

					divName = day + sTimeHour + sTimeMin + CourseCode + CourseType;


					if (inSchedule[divName] == 1) {
						$("#" + divName).remove();
						inSchedule[divName] = 0;
						setSectionSelected(user.term, valueSelected[10], false, function(d) {
							//console.log(d);
						});
					} else {
						addEvent(day, startTime, endTime, subject + " " + valueSelected[0] + " " + valueSelected[9] + "<br />CRN:" + valueSelected[10], courseColours[valueSelected[0]]);
						setSectionSelected(user.term, valueSelected[10], true, function(d) {
							//console.log(d);
						});
					}

				//Else a Lab/Tutorial
				} else if (valueSelected.length > 1) {
					
					startTime = valueSelected[2] + ":" + valueSelected[3].split("-")[0];
					endTime = valueSelected[3].split("-")[1] + ":" + valueSelected[4];
					
					//Variables For The Course
					sTimeHour = startTime.split(":")[0];
					sTimeMin = startTime.split(":")[1];
					CourseCode = valueSelected[0];
					CourseType = valueSelected[5];

					divName = day + sTimeHour + sTimeMin + CourseCode + CourseType;

					crn = valueSelected[6];
					var subject = "";

					$.each(uniqueData, function(key, value) {
						if (value.crn == crn) {
							subject = value.subject;
						}
					});


					$.each(inSchedule, function(data) {
						if(data.indexOf(CourseCode + CourseType) >= 0) {
							$("#" + data).remove();
							inSchedule[data] =  0;
							setSectionSelected(user.term, valueSelected[6], false, function(d) {
								//console.log(d);
							});
						}
					});
					if (inSchedule[divName] == 1) {
						$("#" + divName).remove();
						inSchedule[divName] =  0;
					} else {
						setSectionSelected(user.term, valueSelected[6], true, function(d) {
							//console.log(d);
						});
						addEvent(day, startTime, endTime, subject + " " + valueSelected[0] + " " + valueSelected[5] + "<br />CRN:" +valueSelected[6], courseColours[valueSelected[0]]);
					}
				} else {
					$.each(inSchedule, function(data) {
						if(data.indexOf(valueSelected[0]) >= 0) {
							$("#" + data).remove();
							inSchedule[data] =  0;
							//console.log(data);
							setSectionSelected(user.term, valueSelected[6], false, function(d) {
								//console.log(d);
							});
						}
					});
				}
			}});
	}

	//Open
	$('[data-popup-open]').on('click', function(e) {
		//Hide the background table
		$(".cd-schedule").hide();
		$("#crns > p").remove();

		courseinfo = [];
		//Get all the CRN Info
		$.each(inSchedule, function(data) {
			html = $("#" + data + " em").html();
			course = html.split("<br>")[0]
			crn = html.split("<br>")[1];
			courseinfo.push(course + ": " + crn.split(":")[1]);
			//console.log(course + ": " + crn.split(":")[1]);
		});

		courseinfo = jQuery.unique(courseinfo);
		var fileData = '';
		
		$.each(courseinfo, function(data) {
			$("#crns").append("<p>" + courseinfo[data] + "</p>");
			fileData += courseinfo[data] + '\r\n';
		});
		if (fileData.length > 0) {
			download('crns-' + user.term, fileData);
		}

		var target = $(this).attr('data-popup-open');
		$('[data-popup="' + target + '"]').fadeIn(350);
		e.preventDefault();
	})

	$('[data-popup-close]').on('click', function(e) {
		$(".cd-schedule").show();
		var target = $(this).attr('data-popup-close');
		$('[data-popup="' + target + '"]').fadeOut(350);
		e.preventDefault();
	})

	function clearTable() {
		dropdownhtml = "";
		$.each(inSchedule, function(data) {
			$("#" + data).remove();
		});
	}

	//Filling in the select options, waiting 2 seconds on load to ensure everythings loaded in properly
	setTimeout(function() {
		//console.log(user.data.sections);
		loadCourses();
	}, 2000);
});