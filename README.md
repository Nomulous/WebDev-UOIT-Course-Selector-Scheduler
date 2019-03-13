# CSCI 3230U - Final Project - UOIT Course Scheduler

## Contributors

- [Devon McGrath](https://github.com/DevonMcGrath)
- [Martin Tuzim](https://github.com/Nomulous)

## Description

One of the challenges students (especially first-years) face is creating a good schedule. It can be very time consuming to create a good schedule. This web application allows users to create schedules for a given semester and interactively select sections to include. The resulting schedule with the selected CRNs can be downloaded to easily enter into MyCampus.

## Running the Project Locally

### Requirements:

- Node.js (download [here](https://nodejs.org))
  - Ensure `node` and `npm` are added to your PATH
- MongoDB (download [here](https://www.mongodb.com/))
  - Ensure `mongod` is added to your PATH

### Steps to run:

#### Windows

1. Run `src/start-server.bat`

#### Manual

1. In command prompt/terminal, navigate to `src/`
1. Make a directory called `data`
1. Download dependencies with `npm install`
1. Start MongoDB with `mongod --dbpath .\data`
1. Start the Node server with `node server.js`
1. In your browser, navigate to http://localhost:8080/
