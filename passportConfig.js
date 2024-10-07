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
        // Check if user already exists
        let user = await TimeToMove.findUserByEmail(profile.emails[0].value);
        console.log("User found MAYBE:", user);
        if (user) {
            console.log("User found passport:", user);
            // If user exists, update profile picture if not set
            if (!user.ProfilePicture) {
                console.log("Updating profile picture for user ID: Passport", user.ID);
                console.log("Profile picture URL: Passport", profile.photos[0].value);
                await TimeToMove.updateUserProfilePicture(user.ID, profile.photos[0].value);
            }
            // Link Google account if not already linked
            if (!user.GoogleID) {
                console.log("Linking Google account to userpassport");
                user = await TimeToMove.linkGoogleAccount(user.ID, profile.id);
                console.log("Google account linkedpassport:", user);
                // now update the profile picture
                
            }
        } else {
            // If user doesn't exist, create new user
            console.log("Creating new userpassport");
            user = await TimeToMove.findOrCreateGoogleUser(profile);
            console.log("User createdpassport:", user);
            console.log("Updating profile picture for user ID: Passport", user.ID);
            console.log("Profile picture URL: Passport", profile.photos[0].value);
            await TimeToMove.updateUserProfilePicture(user.ID, profile.photos[0].value);
        }
        console.log("User found or created already passport:", user);
        
        const loginResult = await TimeToMove.loginUserWithGoogle(profile.emails[0].value, profile.id);
        console.log("loginResult passport:", loginResult);
        if (loginResult.success) {
            const userToSerialize = {
                id: loginResult.userId,
                username: loginResult.username
            };
            return done(null, userToSerialize);
        } else {
            return done(null, false, { message: 'Login failed' });
        }

    } catch (error) {
        return done(error, null);
    }
}));

// Serialize user into the sessions
passport.serializeUser((user, done) => {
    console.log("Serializing user passport:", user);
    done(null, user.id);
});

// Deserialize user from the sessions
passport.deserializeUser(async (id, done) => {
    console.log("Deserializing user passport:", id);
    try {
        let user = await TimeToMove.findUserById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

module.exports = passport;
