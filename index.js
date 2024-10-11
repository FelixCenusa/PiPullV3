
const express = require("express");
const session = require('express-session');
const passport = require('passport');
require('dotenv').config(); // To use environment variables
// Require passport configuration
require('./passportConfig');

const app = express();
const indexRoutes = require("./routes/indexRoutes.js");
const path = require('path');
const port = 1337;

// Set up session middleware
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(session({
    secret: process.env.SESSION_SECRET,  // Use a strong secret key
    resave: false,            // Don't save session if unmodified
    saveUninitialized: true,  // Save uninitialized sessions
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Initialize Passport and restore authentication state, if any, from the session.
app.use(passport.initialize()); 
app.use(passport.session());  

// Other middleware (bodyParser, routes, etc.)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static("public"));
app.set("view engine", "ejs");


app.use((req, res, next) =>{
    console.log(`${new Date().toLocaleString()} Got a request on ${req.path}(${req.method})`);
    next();
});

app.use(indexRoutes);

app.listen(port, () =>{
    console.log(`Server is listening on port: ${port}`);
});

// Require and run the cron tasks
require('./cronTasks');