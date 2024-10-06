// passportConfig.js

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const TimeToMove = require('./src/TimeToMove'); // Adjust the path accordingly
console.log("Passport config correctly imported")
// if localhost, callbackURL should be: "http://localhost:1337/auth/google/callback"
// if deployed, callbackURL should be: "https://felixcenusa.com/auth/google/callback"
const isTisProduction = 0; // Change this to 1 if you are deploying
let callBackURLHere = "";
if(isTisProduction){
    callBackURLHere = "https://felixcenusa.com/auth/google/callback";
}
else{
    callBackURLHere = "http://localhost:1337/auth/google/callback";
}
console.log("Callback URL: " + callBackURLHere);
// Configure the Google strategy for use by Passport.

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: callBackURLHere
},
async (accessToken, refreshToken, profile, done) => {
    try {
        // Find or create the user in your database
        let user = await TimeToMove.findOrCreateGoogleUser(profile);
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

// Serialize user into the sessions
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from the sessions
passport.deserializeUser(async (id, done) => {
    try {
        let user = await TimeToMove.findUserById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

module.exports = passport;
