@ECHO off
TITLE UOIT Course Scheduler
REM Name: start-server.bat
REM Author: Devon McGrath
REM Description: This batch script starts the server, database, and downloads
REM any node packages needed.

REM install node modules if necessary
if not exist node_modules/ (
	npm install
)

REM Create database data directory if it does not exist
if not exist data/ (
	mkdir data
)

REM Start the database
START mongod --dbpath .\data

REM Sleep for some time to ensure database has started
ECHO Waiting for database to start...
ping -n 11 127.0.0.1 >nul
ECHO Starting Node server...
ECHO =======================

REM Start the node server
node server.js
pause