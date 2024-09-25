
const express = require("express");
const session = require('express-session');

const app = express();
const indexRoutes = require("./routes/indexRoutes.js");
const path = require('path');
const port = 1337;

// Set up session middleware
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(session({
    secret: 'StrongSecretKeyHereHopeItWorks!123312!"#',  // Use a strong secret key
    resave: false,            // Don't save session if unmodified
    saveUninitialized: true,  // Save uninitialized sessions
    cookie: { secure: false } // Set to true if using HTTPS
}));
// Other middleware (bodyParser, routes, etc.)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(express.urlencoded({extended: true}));

app.use((req, res, next) =>{
    console.log(`${new Date().toLocaleString()} Got a request on ${req.path}(${req.method})`);
    next();
});

app.use(indexRoutes);

app.listen(port, () =>{
    console.log(`Server is listening on port: ${port}`);
});

