"use strict";
const mysql = require("promise-mysql");
const axios = require('axios');
const config = require("../config/db/TimeToMove.json");
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodeMailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();  // Load environment variables
const random = require('lodash/random');
//const tempUsers = new Map();  // You can use Redis or any database for better scalability

// Create the Nodemailer transporter
const transporter = nodeMailer.createTransport({
    service: 'gmail',  // You can replace this with another email service like SendGrid, etc.
    auth: {
        user: process.env.EMAIL_USER,  // Use the email from the .env file
        pass: process.env.EMAIL_PASS   // Use the password from the .env file
    }
});

// Function to send verification email
async function sendVerificationEmail(toEmail, token) {
    const verificationLink = `http://felixcenusa.com/verify?token=${token}`; // Modify the link to pass the token directly

    const mailOptions = {
        from: process.env.EMAIL_USER,  // Sender's email address from .env
        to: toEmail,  // Receiver's email address
        subject: 'Email Verification for TimeToMove',  // Subject of the email
        html: `<h2>Email Verification</h2>
               <p>Click the link below to verify your email:</p>
               <a href="${verificationLink}">Verify Email</a>
               <p>The link is valid for 24 hours.</p>
               <p>Or copy and paste the following digits into the TimeToMove website:</p>
               <h1>${token.slice(0, 3)} ${token.slice(3, 6)} ${token.slice(6, 9)}</h1>
               <p>If you didn't request this email, you can safely ignore it.</p>`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Verification email sent to:', toEmail);
    } catch (error) {
        console.error('Error sending verification email:', error);
    }
}

// Create a function to send emails
async function sendEmail(name, email, message){
    try {
        // Email content
        let mailOptions = {
            from: `"${name}" <${email}>`, // Sender name and email
            to: 'felixcenusa@gmail.com', // The email address to send to
            subject: 'TimeToMove Contact Me Please', // Email subject
            text: `You have a new message from ${name} (${email}):\n\n${message}`, // Email body
        };

        // Send the email
        let info = await transporter.sendMail(mailOptions);
        console.log('Message sent: %s', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};


// Function to generate a password reset token and store it
async function generatePasswordResetToken(email) {
    const db = await mysql.createConnection(config);

    // Check if the email exists in the database and get the associated username
    const checkEmailSql = `SELECT * FROM Users WHERE Email = ?`;
    const users = await db.query(checkEmailSql, [email]);

    if (users.length === 0) {
        return { success: false, message: 'Email not found.' };
    }

    const username = users[0].Username;

    // Generate a reset token
    const token = crypto.randomBytes(32).toString('hex');

    // Store the token in the database (with an expiration time, e.g., 1 hour)
    const expireTime = new Date(Date.now() + 3600000); // 1 hour from now
    const sql = `INSERT INTO PasswordResets (Email, Token, ExpiresAt) VALUES (?, ?, ?)`;
    await db.query(sql, [email, token, expireTime]);

    return { success: true, token, username };
}

// Function to send the reset password email
async function sendResetPasswordEmail(toEmail, token, username) {
    const resetLink = `http://felixcenusa.com/resetPassword?token=${token}`;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: toEmail,
        subject: 'Password Reset for TimeToMove',
        html: `<h2>Password Reset for user ${username}</h2>
               <p>Click the link below to reset your password:</p>
               <h1><a href="${resetLink}">Reset Password</a></h1>
               <p>The link is valid for 1 hour.</p>`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Password reset email sent to:', toEmail);
    } catch (error) {
        console.error('Error sending password reset email:', error);
    }
}

async function resetPassword(token, newPassword) {
    const db = await mysql.createConnection(config);

    try {
        // Check if the token is valid and not expired
        const sql = `SELECT * FROM PasswordResets WHERE Token = ? AND ExpiresAt > NOW()`;
        const resetRequests = await db.query(sql, [token]);

        if (resetRequests.length === 0) {
            return { success: false, message: 'Invalid or expired token.' };
        }

        const email = resetRequests[0].Email;

        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update the user's password
        const updatePasswordSql = `UPDATE Users SET PasswordHash = ? WHERE Email = ?`;
        await db.query(updatePasswordSql, [hashedPassword, email]);

        // Delete the reset token after successful reset
        const deleteTokenSql = `DELETE FROM PasswordResets WHERE Token = ?`;
        await db.query(deleteTokenSql, [token]);

        return { success: true, message: 'Password has been reset successfully.' };

    } catch (error) {
        console.error('Error resetting password:', error);
        return { success: false, message: 'Error resetting password.' };
    } finally {
        await db.end();
    }
}


// Function to validate password strength
function validatePassword(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[\W_]/.test(password);

    if (password.length < minLength || !hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
        return false;
    }
    return true;
}

// Enhanced createUser function
async function createUser(username, email, password) {
    const db = await mysql.createConnection(config);
    // Generate a unique 9-digit verification token
    const token = Math.floor(100000000 + Math.random() * 900000000).toString();
    try {
        const restrictedUsernames = [
            'admin', 'felix', 'felixcenusa', 'felixcen', 'TimeToMove', 'timetomove', 'timetomoveofficial', 'timetomoveofficialcom',
            'updateUsername', 'kanban', 'delete-task', 'leaderboard', 'sharedWithYou', 'youShared', 'share', 'profiles', 'about', 
            'login', 'register', 'labelStyles', 'settings', 'privacyPolicy', 'termsOfService', 'contact', 
            'help', 'faq', 'privacy', 'cookie', 'security', 'dmca', 'copyright', 'legal', 'imprint', 
            'disclaimer', 'privacy-policy', 'terms-of-service', 'contact-us', 'help-support', 'faq-page', 
            'privacy-settings', 'cookie-settings', 'security-settings', 'dmca-notice', 'copyright-notice',
             'legal-notice', 'imprint-notice', 'disclaimer-notice'
        ];
        if (restrictedUsernames.includes(username.toLowerCase())) {
            return { success: false, message: 'This username is not allowed.' };
        }
        // Check if the username already exists
        const checkUsernameSql = `SELECT * FROM Users WHERE Username = ?`;
        const existingUsernames = await db.query(checkUsernameSql, [username]);

        if (Array.isArray(existingUsernames) && existingUsernames.length > 0) {
            console.error('Error: Username already exists.');
            return { success: false, message: 'Username already exists.' };
        }

        // Check if the email already exists
        const checkEmailSql = `SELECT * FROM Users WHERE Email = ?`;
        const existingEmails = await db.query(checkEmailSql, [email]);

        if (Array.isArray(existingEmails) && existingEmails.length > 0) {
            console.error('Error: Email already exists.');
            return { success: false, message: 'Email already exists.' };
        }

        // Validate username length
        if (username.length < 3) {
            console.error('Error: Username must be at least 3 characters long.');
            return { success: false, message: 'Username must be at least 3 characters long.' };
        }
        if (username.length > 20) {
            console.error('Error: Username must be at most 20 characters long.');
            return { success: false, message: 'Username must be at most 20 characters long.' };
        }

        // Validate email format
        const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailPattern.test(email)) {
            console.error('Error: Invalid email format.');
            return { success: false, message: 'Invalid email format.' };
        }
        console.log('Query result for username:', existingUsernames);
        console.log('Query result for email:', existingEmails);


        // Validate password strength
        if (!validatePassword(password)) {
            console.error('Error: Password is too weak.');
            return {
                success: false,
                message: 'Password is too weak. It must be at least 8 characters long, contain upper and lowercase letters, numbers, and a special character.'
            };
        }

        // Hash password Bcrypt adds the salt automacally and stores it in the hash
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);


        // // Generate a unique verification token
        // const token = crypto.randomBytes(32).toString('hex');

        // Insert the user into the TempUsers table with the verification token
        const sql = `INSERT INTO TempUsers (Username, Email, PasswordHash, VerificationToken)
                     VALUES (?, ?, ?, ?)`;
        await db.query(sql, [username, email, hashedPassword, token]);

        // Create user directory
        const rootDir = path.resolve(__dirname, '..');
        const userDir = path.join(rootDir, 'uploads', username);
        fs.mkdirSync(userDir, { recursive: true });
        console.log("User directory created:", userDir);

        // Send verification email
        await sendVerificationEmail(email, token);

        return { success: true, message: 'Verification token sent. Please check your email.' }

    } catch (err) {
        console.error('Error creating user:', err);
        return { success: false, message: 'Error creating user' };
    } finally {
        await db.end();
    }
}

async function verify(token) {
    const db = await mysql.createConnection(config);

    try {
        // Check if the token exists in the TempUsers table
        const sql = `SELECT * FROM TempUsers WHERE VerificationToken = ?`;
        const tempUsers = await db.query(sql, [token]);
        console.log('Query result for tempUsers verify:', tempUsers);  // Debugging the full result


        if (tempUsers.length === 0) {
            return { success: false, message: 'Invalid or expired token.' };
        }

        // Manually convert the RowDataPacket to a plain object
        const tempUser = Object.assign({}, tempUsers[0]);  // Using Object.assign to convert RowDataPacket
        console.log('Retrieved tempUser:', tempUser);  // Debugging the retrieved user

        // Check if CreatedAt exists
        if (!tempUser.CreatedAt) {
            return { success: false, message: 'CreatedAt field missing from result.' };
        }

        // Calculate token age (in minutes)
        const now = new Date();
        const createdAt = new Date(tempUser.CreatedAt);
        const tokenAge = (now - createdAt) / (1000 * 60);  // Time difference in minutes
        console.log("now", now)
        console.log("createdAt", createdAt)
        console.log("tokenAge", tokenAge)

        if (tokenAge > 1440) {
            // Delete the expired token
            await db.query(`DELETE FROM TempUsers WHERE VerificationToken = ?`, [token]);
            return { success: false, message: 'Token has expired. Please register again.' };
        }

        // Clean up any other expired temp users (24 hours expiration check)
        const cleanupSql = `DELETE FROM TempUsers WHERE TIMESTAMPDIFF(MINUTE, CreatedAt, NOW()) > 1440`;
        await db.query(cleanupSql);
        console.log('Expired temp users cleaned up.');

        // Move the user from TempUsers to Users table  // add salt
        const insertSql = `INSERT INTO Users (Username, Email, PasswordHash)
                           VALUES (?, ?, ?)`;

        await db.query(`DELETE FROM TempUsers WHERE VerificationToken = ?`, [token]);
        console.log("GOT THIS FAR 1")
        await db.query(insertSql, [tempUser.Username, tempUser.Email, tempUser.PasswordHash]);
        // Delete the user from TempUsers after verification
        console.log("GOT THIS FAR 2")
        // Now send a welcome email to the user
        const welcomeEmail = {
            from: process.env.EMAIL_USER,
            to: tempUser.Email,
            subject: 'Welcome to TimeToMove!',
            html: `<h2>Welcome to TimeToMove, ${tempUser.Username}!</h2><h3> Glad to have you on board!</h3>
                   <p>Your email has been successfully verified.</p>`
        };
        console.log("GOT THIS FAR 3")
        await transporter.sendMail(welcomeEmail);
        console.log("GOT THIS FAR 4")



        return { success: true, message: 'Your email has been successfully verified!' };
    } catch (error) {
        console.error('Error verifying token:', error);
        return { success: false, message: 'Error during verification.' };
    } finally {
        await db.end();
    }
}

// Define the deleteUser function
async function deleteUser(username) {
    const db = await mysql.createConnection(config);
    try {
        // 1. Check if the user exists
        const userResult = await db.query(`SELECT ID FROM Users WHERE Username = ?`, [username]);
        if (userResult.length === 0) {
            return { success: false, message: 'User not found.' };
        }
        const userID = userResult[0].ID;

        // 2. Get the user's boxes
        const boxes = await db.query(`SELECT BoxID FROM Boxes WHERE UserID = ?`, [userID]);

        // 3. Iterate over each box to delete its media and local storage
        for (const box of boxes) {
            const boxID = box.BoxID;

            // Delete media from BoxMedia in the database
            await db.query(`DELETE FROM BoxMedia WHERE BoxID = ?`, [boxID]);

            // Define the path to the box's folder in local storage
            const boxPath = path.join(__dirname, 'uploads', username, String(boxID));

            // Recursively delete the box's folder and contents if it exists
            if (fs.existsSync(boxPath)) {
                fs.rmSync(boxPath, { recursive: true, force: true });
            }

            // Delete the box from the Boxes table
            await db.query(`DELETE FROM Boxes WHERE BoxID = ?`, [boxID]);
        }

        // 4. After all boxes are deleted, delete the user's folder
        const userFolderPath = path.join(__dirname, 'uploads', username);
        if (fs.existsSync(userFolderPath)) {
            fs.rmSync(userFolderPath, { recursive: true, force: true });
        }

        // 5. Finally, delete the user from the Users table
        await db.query(`DELETE FROM Users WHERE ID = ?`, [userID]);

        return { success: true, message: `User '${username}' and all associated data deleted successfully.` };
    } catch (error) {
        console.error('Error deleting user:', error);
        throw error;
    } finally {
        await db.end();
    }
}

        






// Enhanced createUser function
async function createFakeUser(username, email, password) {
    console.log("GotThisFar11")
    const db = await mysql.createConnection(config);
    console.log("GotThisFar12")
    const sql = `SELECT * FROM TempUsers WHERE VerificationToken = ?`;
    console.log("GotThisFar13")
    const token = 123
    const tempUsers = await db.query(sql, [token]);
    console.log('Query result for tempUsers CreateFakeUseer:', tempUsers);  // Debugging the full result

    try {
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);


        // Generate a unique verification token

        // Insert the user into the TempUsers table with the verification token
        const sql = `INSERT INTO Users (Username, Email, PasswordHash)
                     VALUES (?, ?, ?)`;
        await db.query(sql, [username, email, hashedPassword, token]);


        return { success: true, message: 'Verification token sent. Please check your email.' }

    } catch (err) {
        console.error('Error creating user:', err);
        return { success: false, message: 'Error creating user' };
    } finally {
        await db.end();
    }
}

async function fakeVerify(token) {
    const db = await mysql.createConnection(config);
    // Check if the token exists in the TempUsers table
    console.log("GotThisFar1")
    
    try {
        
        // Delete the user from TempUsers after verification
        await db.query(`DELETE FROM TempUsers WHERE VerificationToken = ?`, [123]);

        return { success: true, message: 'Your email has been successfully verified!' };
    } catch (error) {
        console.error('Error verifying token:', error);
        return { success: false, message: 'Error during verification.' };
    } finally {
        await db.end();
    }
}





// Function to log in the user by checking username and password
async function loginUser(username, password) {
    const db = await mysql.createConnection(config);

    try {
        // Log the query and username for debugging
        console.log('Logging in with username:', username);

        const sql = `SELECT ID, Username, PasswordHash FROM Users WHERE Username = ?`;
        let res = await db.query(sql, [username]);

        // Log the query result
        //console.log('Query result:', res);

        // Check if the user exists
        if (res.length === 0) {
            return { success: false, message: 'User does not exist' };
        }

        const user = res[0];
        // salt needed?
        // Verify the password (assuming bcrypt is used)
        const passwordMatch = await bcrypt.compare(password, user.PasswordHash);

        if (!passwordMatch) {
            return { success: false, message: 'Incorrect password' };
        }

        // Return the user's ID and username on successful login
        return {
            success: true,
            userId: user.ID,
            username: user.Username
        };
    } catch (error) {
        console.error('Error during loginUser:', error);
        return { success: false, message: 'Login error' };
    } finally {
        await db.end();
    }
}

async function loginUserWithGoogle(email, googleId) {
    const db = await mysql.createConnection(config);

    try {
        // Check if the user exists by email or Google ID
        const sql = `SELECT ID, Username, GoogleID FROM Users WHERE Email = ? OR GoogleID = ?`;
        const [rows] = await db.query(sql, [email, googleId]);

        if (rows.length === 0) {
            console.error('User does not exist:', email, googleId);
            return { success: false, message: 'User does not exist' };
        }
        const user = rows; // Get the first user from the result

        // Check if user object and its properties exist
        if (!user || !user.ID || !user.Username) {
            console.error('Invalid user data:', user);
            return { success: false, message: 'Invalid user data' };
        }


        // Return the user's ID and username on successful login
        return {
            success: true,
            userId: user.ID,
            username: user.Username,
        };
    } catch (error) {
        console.error('Error during loginUserWithGoogle:', error);
        return { success: false, message: 'Login error' };
    } finally {
        await db.end();
    }
}






// Function to get all users from the Users table
async function getAllUsers() {
    const db = await mysql.createConnection(config);

    try {
        const sql = `SELECT Username, Email FROM Users`;  // Adjust the columns as needed
        let res = await db.query(sql);
        // console log all the users
        console.log('All users:', res);

        return res;
    } catch (err) {
        console.error('Error fetching users:', err);
        return [];
    } finally {
        await db.end();
    }
}

// Function to fetch all boxes created by a specific user with sorting
async function getUserBoxes(userId, sortQuery = 'ORDER BY BoxID DESC') {
    const db = await mysql.createConnection(config);

    try {
        const sql = `SELECT * FROM Boxes WHERE UserID = ? ${sortQuery}`;
        let res = await db.query(sql, [userId]);

        // Log the result for debugging
        // console.log('Fetched user boxes:', res);

        return res;
    } catch (error) {
        console.error('Error fetching user boxes:', error);
        return [];
    } finally {
        await db.end();
    }
}




// // Function to create a new box (only box-specific details)
// async function createBox(userId, isBoxPublic, label) {
//     const db = await mysql.createConnection(config);

//     try {
//         const sql = `INSERT INTO Boxes (UserID, IsBoxPublic, TitleChosen, NrOfFiles) VALUES (?, ?, ?, 0)`;
//         await db.query(sql, [userId, isBoxPublic, label]);  // Potential issue here
//         console.log('New box created successfully.');
//     } catch (error) {
//         console.error('Error creating new box:', error);
//     } finally {
//         await db.end();
//     }
// }

// Function to create a new box (includes label style and border round)
async function createBox(userId, isBoxPublic, label, labelStyleUrl, borderImageSlice, borderImageRepeat) {
    const db = await mysql.createConnection(config);
    // console.log("userId", userId);
    // console.log("isBoxPublic", isBoxPublic);
    // console.log("label", label);
    // console.log("labelStyleUrl", labelStyleUrl);
    // console.log("borderImageSlice", borderImageSlice);
    // console.log("borderImageRepeat", borderImageRepeat);
    // console.log("Inside createBox function");
    try {
        const sql = `
            INSERT INTO Boxes (UserID, IsBoxPublic, TitleChosen, NrOfFiles, LabelChosen, BorderImageSlice, BorderImageRepeat)
            VALUES (?, ?, ?, 0, ?, ?, ?)
        `;
        await db.query(sql, [userId, isBoxPublic, label, labelStyleUrl, borderImageSlice, borderImageRepeat]);
        console.log('New box created successfully.');
    } catch (error) {
        console.error('Error creating new box:', error);
        throw error;
    } finally {
        await db.end();
    }
}


// Function to add media to an existing box
async function addToBox(boxID, mediaType, mediaPaths) {
    const db = await mysql.createConnection(config);
    
    try {
        let sql;
        let params;
        sql = `INSERT INTO BoxMedia (BoxID, MediaType, MediaPath) VALUES (?, ?, ?)`;
        params = [boxID, mediaType, path];
        await db.query(sql, params);

        console.log(`Media items added to box with ID:`, boxID);
    } catch (err) {
        console.error(`Error adding media to box:`, err);
    } finally {
        await db.end();
    }
}

// Function to get a box by its ID
async function getBoxByIDONLY(boxID) {
    const db = await mysql.createConnection(config);

    try {
        console.log('Fetched box by IDNOTYERTTTT:');
        // Query to fetch the box information based on the provided boxID
        const [box] = await db.query('SELECT * FROM Boxes WHERE BoxID = ?', [boxID]);
        console.log('Fetched box by IssssD:', box);
        console.log('Fetched box by IssssD000:', box[0]);

        // If no box is found, return null
        if (!box) {
            return null;
        }

        return box;
    } catch (err) {
        console.error('Error fetching box by ID:', err);
        throw err;
    } finally {
        await db.end(); // Ensure connection is closed after query
    }
}


async function getBoxID(username, boxName){
    const userID = await getUserByUsername(username);
    const db = await mysql.createConnection(config);
    try {
        console.log("GetBoxID username:", username);
        const sql = `SELECT BoxID FROM Boxes WHERE UserID = ? AND TitleChosen = ?`;
        console.log("GetBoxID username:", username);
        console.log("boxName:", boxName);
        console.log("UserID:", userID.ID);
        console.log("LabelChiosen:", boxName);

        
        const boxID = await db.query(sql, [userID.ID, boxName]);
        console.log("BoxID:", boxID);
        console.log("GetBoxID result:", boxID);
        return boxID;
    } catch (error) {
        console.error('Error fetching box ID:', error);
        return null;
    } finally {
        await db.end();
    }
}


// Function to retrieve all media paths for a box
async function getBoxMedia(boxID) {
    const db = await mysql.createConnection(config);

    try {
        const [images] = await db.query(`SELECT ImgPath FROM BoxImages WHERE BoxID = ?`, [boxID]);
        const [audios] = await db.query(`SELECT AudioPath FROM BoxAudio WHERE BoxID = ?`, [boxID]);
        const [videos] = await db.query(`SELECT VideoPath FROM BoxVideos WHERE BoxID = ?`, [boxID]);

        return {
            images: images.map(img => img.ImgPath),
            audios: audios.map(audio => audio.AudioPath),
            videos: videos.map(video => video.VideoPath)
        };
    } catch (err) {
        console.error('Error retrieving box media:', err);
    } finally {
        await db.end();
    }
}

// Fetch user by username
// Fetch user by username
async function getUserByUsername(username) {
    const db = await mysql.createConnection(config);

    try {
        // Normalize the username to avoid case or whitespace issues
        const normalizedUsername = username.trim().toLowerCase();

        // Log the normalized username for debugging
        //console.log('Fetching user with username:', normalizedUsername);

        // Use LOWER() in the SQL query to ignore case sensitivity
        const sql = `SELECT * FROM Users WHERE LOWER(Username) = ?`;
        const [users] = await db.query(sql, [normalizedUsername]);

        // Log the result of the query
        //console.log('User query result:', users);

        // Check if any user was found and return the user, otherwise return null
        return users
    } catch (error) {
        console.error('Error fetching user by username:', error);
        return null;
    } finally {
        await db.end();
    }
}



// Fetch box by label and userID
async function getBoxByID(userID, BoxID) {
    const db = await mysql.createConnection(config);
    try {
        // Log the userID and TitleChosen for debugging
        console.log('Fetching box for userID:', userID, 'with BoxID:', BoxID);

        const sql = `SELECT * FROM Boxes WHERE UserID = ? AND BoxID = ?`;
        const boxes = await db.query(sql, [userID, BoxID]);
        
        // Log the result of the query
        console.log('Box query result:', boxes);

        return boxes
    } catch (error) {
        console.error('Error fetching box by label:', error);
        return null;
    } finally {
        await db.end();
    }
}










async function insertMediaIntoBox(boxID, mediaPath, mediaType) {
    const db = await mysql.createConnection(config);
    console.log("InsertAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAing media into boxID:", boxID);

    try {
        // Check if the media already exists in the BoxMedia table
        const checkSql = `SELECT * FROM BoxMedia WHERE BoxID = ? AND MediaPath = ?`;
        const existingMedia = await db.query(checkSql, [boxID, mediaPath]);
        console.log("boxID:", boxID);
        console.log("mediaPath:", mediaPath);

        console.log('Existing media query result:', existingMedia);

        // Handle cases where existingMedia is undefined or null
        if (!existingMedia) {
            console.error('Error: The existing media query returned undefined.');
            return { success: false, errorMessage: "Error checking for existing media." };
        }

        // Check if the media is already present
        if (existingMedia.length > 0) {
            console.log(`Media already exists for boxID ${boxID}: ${mediaPath}`);
            return { success: false, errorMessage: "This media has already been added to the box." };
        }

        // Proceed to insert the media if it doesn't exist
        const sql = `INSERT INTO BoxMedia (BoxID, MediaPath, MediaType, MediaSize) VALUES (?, ?, ?, ?)`;

        // Ensure the filePath is constructed correctly
        const filePath = path.join(__dirname, '..', 'uploads', mediaPath);  // mediaPath should already be relative
        const content = { fileSize: 0 };

        // Get file size
        try {
            const stats = fs.statSync(filePath);
            content.fileSize = stats.size; // File size in bytes
            console.log(`File size for ${filePath}:`, content.fileSize);
        } catch (err) {
            console.error(`Error fetching file size for ${filePath}:`, err);
            content.fileSize = 0; // Default to 0 if error occurs
        }

        const MediaSize = content.fileSize;
        await db.query(sql, [boxID, mediaPath, mediaType, MediaSize]);
        console.log(`Media inserted for boxID ${boxID}: ${mediaPath} (${mediaType})`);

        // Update the NrOfFiles in the corresponding box
        const updateNrOfFilesSql = `UPDATE Boxes SET NrOfFiles = NrOfFiles + 1 WHERE BoxID = ?`;
        await db.query(updateNrOfFilesSql, [boxID]);
        console.log(`NrOfFiles updated for boxID ${boxID}`);

        return { success: true, message: "Media added successfully." };

    } catch (err) {
        console.error('Error inserting media into BoxMedia or updating NrOfFiles:', err);
        return { success: false, message: "Error inserting media." };
    } finally {
        await db.end();
    }
}





async function getBoxContents(boxID) {
    const db = await mysql.createConnection(config);

    try {
        const sql = `SELECT * FROM BoxMedia WHERE BoxID = ?`;
        const contents = await db.query(sql, [boxID]); // No destructuring
        //console.log(`Fetched box contents for boxID ${boxID}:`, contents);
        return contents; // Return the entire result set
    } catch (err) {
        console.error('Error fetching box contents:', err);
        return [];
    } finally {
        await db.end();
    }
}



// Function to update stealth mode for a user
async function updateStealthMode(userID, stealthMode) {
    const db = await mysql.createConnection(config);
    const sql = `UPDATE Users SET StealthMode = ? WHERE ID = ?`;

    try {
        const [result] = await db.query(sql, [stealthMode, userID]);
        console.log(`Stealth mode updated for user ID: ${userID}`);
    } catch (err) {
        console.error('Error updating stealth mode:', err);
    } finally {
        await db.end();
    }
}


// Function to log a visit
async function logVisit(userID, ipAddress, visitedBy) {
    const db = await mysql.createConnection(config);
    const hashedIP = crypto.createHash('sha256').update(ipAddress).digest('hex');
    const sql = `INSERT INTO Visited (UserID, HashedIP, VisitedBy) VALUES (?, ?, ?)`;
    
    try {
        const [result] = await db.query(sql, [userID, hashedIP, visitedBy]);
        console.log('Visit logged for user ID:', userID);
    } catch (err) {
        console.error('Error logging visit:', err);
    } finally {
        await db.end();
    }
}

// Function to get the leaderboard of public users
async function getPublicLeaderboard() {
    const db = await mysql.createConnection(config);
    const sql = `
    SELECT u.Username, COUNT(b.BoxID) AS BoxCount, 
               SUM(LENGTH(b.TextPath) + LENGTH(b.AudioPath) + LENGTH(b.ImgPath) + LENGTH(b.VideoPath)) AS TotalBoxContentSize
               FROM Users u
        LEFT JOIN Boxes b ON u.ID = b.UserID
        GROUP BY u.Username
        ORDER BY BoxCount DESC, TotalBoxContentSize DESC
    `;

    try {
        const [results] = await db.query(sql);
        console.log('Public leaderboard:', results);
        return results;
    } catch (err) {
        console.error('Error getting leaderboard:', err);
    } finally {
        await db.end();
    }
}

async function getLeaderboardData() {
    const db = await mysql.createConnection(config);

    try {
        const sql = `
            SELECT 
                u.Username, 
                u.UserPFP, 
                SUM(b.NrOfFiles) AS TotalFilesUploaded, 
                SUM(bm.MediaSize) AS TotalMediaSize,
                (SUM(b.NrOfFiles) / (SUM(bm.MediaSize) / (1024 * 1024))) AS FilesPerMB
            FROM 
                Users u
            JOIN 
                Boxes b ON u.ID = b.UserID
            JOIN 
                BoxMedia bm ON b.BoxID = bm.BoxID
            GROUP BY 
                u.Username;
        `;
        const rows = await db.query(sql);
        console.log("SQL Query Result:", rows); // Log the result

        return rows; // Return the array of rows, don't wrap with Array.isArray
    } catch (error) {
        console.error('Error fetching leaderboard data:', error);
        return [];
    } finally {
        await db.end();
    }
}

async function getLeaderboardStats() {
    let db;

    try {
        // Create a connection to the database
        db = await mysql.createConnection(config);

        // Fetch leaderboard data (username, files uploaded, total media size, files per MB)
        const leaderboardQuery = `
            SELECT 
                Users.Username,
                Users.UserPFP,
                SUM(BoxMedia.MediaSize) AS TotalMediaSize,
                COUNT(BoxMedia.MediaID) AS TotalFilesUploaded,
                (COUNT(BoxMedia.MediaID) / (SUM(BoxMedia.MediaSize) / (1024 * 1024))) AS FilesPerMB
            FROM Users
            LEFT JOIN Boxes ON Users.ID = Boxes.UserID
            LEFT JOIN BoxMedia ON Boxes.BoxID = BoxMedia.BoxID
            GROUP BY Users.Username, Users.UserPFP
        `;
        const leaderboard = await db.query(leaderboardQuery);

        // Get total files uploaded across all boxes
        const totalFilesResult = await db.query('SELECT SUM(NrOfFiles) AS totalFilesUploaded FROM Boxes');
        const totalFilesUploaded = totalFilesResult[0].totalFilesUploaded || 0;

        // Get total media size across all media files
        const totalMediaSizeResult = await db.query('SELECT SUM(MediaSize) AS totalMediaSize FROM BoxMedia');
        const totalMediaSize = totalMediaSizeResult[0].totalMediaSize || 0;

        // Get total number of users
        const totalUsersResult = await db.query('SELECT COUNT(*) AS totalUsers FROM Users');
        const totalUsers = totalUsersResult[0].totalUsers || 0;
        const totalLinesOfCode = countLines();

        return {
            leaderboard,
            totalFilesUploaded,
            totalMediaSize,
            totalUsers,
            totalLinesOfCode
        };
    } catch (err) {
        console.error('Error fetching leaderboard stats:', err);
        return {
            leaderboard: [],
            totalFilesUploaded: 0,
            totalMediaSize: 0,
            totalUsers: 0,
        };
    } finally {
        if (db) {
            await db.end(); // Close the connection
        }
    }
}


async function deleteMedia(mediaID) {
    const db = await mysql.createConnection(config);

    try {
        // Get the media path and BoxID before deleting it
        const [mediaResult] = await db.query('SELECT MediaPath, BoxID FROM BoxMedia WHERE MediaID = ?', [mediaID]);
        console.log('Media to delete:', mediaResult);

        // Check if the result is not empty
        if (mediaResult && mediaResult.MediaPath) {
            console.log('MediaPath to delete:', mediaResult.MediaPath);

            // Construct the file path
            const filePath = path.join(__dirname, '..', 'uploads', mediaResult.MediaPath);
            console.log('Deleting file:', filePath);

            // Delete the file from the file system
            fs.unlinkSync(filePath);

            // Delete the record from the database
            await db.query('DELETE FROM BoxMedia WHERE MediaID = ?', [mediaID]);

            // After deleting media, decrement the NrOfFiles in the corresponding box
            await db.query('UPDATE Boxes SET NrOfFiles = NrOfFiles - 1 WHERE BoxID = ?', [mediaResult.BoxID]);
            console.log(`NrOfFiles decremented for BoxID ${mediaResult.BoxID}`);
        } else {
            console.log('No media found with that MediaID');
        }
    } catch (err) {
        console.error('Error deleting media:', err);
    } finally {
        await db.end();
    }
}


// Function to rename a box
async function renameBox(boxID, newBoxName) {
    const db = await mysql.createConnection(config);

    try {
        // SQL query to update the box name
        const result = await db.query('UPDATE Boxes SET TitleChosen = ? WHERE BoxID = ?', [newBoxName, boxID]);
        console.log('Update result HEREEEEEEEEEE:', result);
        if (result.affectedRows > 0) {
            console.log(`Box ID ${boxID} successfully renamed to ${newBoxName}`);
            return { success: true };
        } else {
            return { success: false, message: 'Box not found or name not changed' };
        }
    } catch (err) {
        console.error('Error renaming the box:', err);
        return { success: false, message: 'Error renaming the box' };
    } finally {
        await db.end();
    }
}

async function deleteBoxWithContents(boxID) {
    const db = await mysql.createConnection(config);
    
    try {
        // Get the media files to delete
        const mediaFiles = await db.query('SELECT MediaPath FROM BoxMedia WHERE BoxID = ?', [boxID]);

        // Delete media files from the file system
        for (const media of mediaFiles) {
            const filePath = path.join(__dirname, '..', 'uploads', media.MediaPath);
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);  // Delete the file from the file system
                    console.log(`Deleted file: ${filePath}`);
                } else {
                    console.log(`File not found: ${filePath}`);
                }
            } catch (err) {
                console.error(`Error deleting file ${filePath}:`, err);
            }
        }

        // Delete media from the BoxMedia table
        await db.query('DELETE FROM BoxMedia WHERE BoxID = ?', [boxID]);

        // Delete the box from the Boxes table
        await db.query('DELETE FROM Boxes WHERE BoxID = ?', [boxID]);

        console.log(`Box ID ${boxID} and all its contents deleted successfully`);
    } catch (err) {
        console.error('Error deleting box and its contents:', err);
        throw err;
    } finally {
        await db.end(); // Ensure connection is closed after query
    }
}


// Function to update user description
async function updateUserDescription(username, description) {
    const db = await mysql.createConnection(config);  // Ensure your config is properly set

    try {
        // Ensure the description doesn't exceed the limit and handle other sanitization
        const sanitizedDescription = description.slice(0, 4095); // Max length 4095 chars

        // Update the user's description in the database
        const result = await db.query('UPDATE Users SET UserDescription = ? WHERE Username = ?', [sanitizedDescription, username]);

        if (result.affectedRows > 0) {
            return { success: true };
        } else {
            return { success: false, message: 'User not found or description not updated' };
        }
    } catch (error) {
        console.error('Error updating user description:', error);
        return { success: false, message: 'Database error' };
    } finally {
        await db.end();
    }
}


// Function to update box name and description
async function updateBox(boxID, newBoxName, newBoxDescription, isBoxPublic, withDigitCode) {
    const db = await mysql.createConnection(config);

    try {
        const sanitizedDescription = newBoxDescription.slice(0, 4095); // Max length 4095 chars
        const query = `
            UPDATE Boxes
            SET
                TitleChosen = ?,
                BoxDescription = ?,
                IsBoxPublic = ?,
                DigitCodeIfPrivate = ?
            WHERE BoxID = ?
        `;
        const values = [newBoxName, sanitizedDescription, isBoxPublic, withDigitCode, boxID];
        await db.query(query, values);
        console.log(`Box ${boxID} updated successfully.`);
    } catch (error) {
        console.error('Error updating box in database:', error);
        throw error;
    } finally {
        await db.end();
    }
}


// Function to update user's profile picture
async function updateUserProfilePic(username, filename) {
    const db = await mysql.createConnection(config);

    try {
        const sql = 'UPDATE Users SET UserPFP = ? WHERE Username = ?';
        const result = await db.query(sql, [filename, username]);

        if (result.affectedRows > 0) {
            console.log(`Profile picture updated for user: ${username}`);
            return { success: true };
        } else {
            console.error('User not found or profile picture not updated.');
            return { success: false, message: 'User not found or profile picture not updated.' };
        }
    } catch (error) {
        console.error('Error updating user profile picture:', error);
        throw error;
    } finally {
        await db.end();
    }
}

// Function to retrieve the profile picture from the database
async function getUserProfilePic(username) {
    const db = await mysql.createConnection(config);
    try {
        const sql = 'SELECT UserPFP FROM Users WHERE Username = ?';
        // Query to get the profile picture filename from the users table
        const result = await db.query(sql, [username]);

        // console.log('Profile picture result:', result);
        // console.log('Profile picture result0:', result[0]);
        // console.log('Profile picture result0UserPFP:', result[0]?.UserPFP);


        return result[0]?.UserPFP;
    } catch (error) {
        console.error('Error fetching user profile picture:', error);
        throw error;
    } finally {
        await db.end();
    }
}

// Function to find or create a Google user
async function findOrCreateGoogleUser(profile) {
    const db = await mysql.createConnection(config);

    try {
        const googleId = profile.id;
        const displayName = profile.displayName.replace(/\s+/g, '_');
        const email = profile.emails[0].value;

        // Check if the user already exists by email
        let sql = `SELECT * FROM Users WHERE Email = ?`;
        let res = await db.query(sql, [email]);

        if (res && res.length > 0) {
            // User exists, update GoogleID if not set
            if (!res[0].GoogleID) {
                await db.query('UPDATE Users SET GoogleID = ? WHERE ID = ?', [googleId, res[0].ID]);
            }
            return res[0];
        } else {
            // Create a new user
            const insertSql = `INSERT INTO Users (Username, Email, GoogleID) VALUES (?, ?, ?)`;
            const result = await db.query(insertSql, [displayName, email, googleId]);

            // Fetch the new user
            const newUserSql = `SELECT * FROM Users WHERE ID = ?`;
            const newUserRes = await db.query(newUserSql, [result.insertId]);

            // Create user directory
            const rootDir = path.resolve(__dirname, '..');
            const userDir = path.join(rootDir, 'uploads', displayName);
            fs.mkdirSync(userDir, { recursive: true });
            console.log("User directory created:", userDir);

            return newUserRes[0];
        }
    } catch (error) {
        console.error('Error in findOrCreateGoogleUser:', error);
        throw error;
    } finally {
        await db.end();
    }
}

async function updateUserProfilePicture(userId, profilePictureUrl) {
    console.log("Updating profile picture for user ID:", userId);
    console.log("Profile picture URL:", profilePictureUrl);
    const db = await mysql.createConnection(config);
    try {
        // Download and save the profile picture
        const localPath = await downloadAndSaveProfilePicture(userId, profilePictureUrl);

        // Update the user's profile picture path in the database
        const sql = `UPDATE Users SET UserPFP = ? WHERE ID = ?`;
        await db.query(sql, [localPath, userId]);
        console.log(`Updated profile picture for user ID: ${userId}`);
    } catch (error) {
        console.error('Error updating profile picture:', error);
        throw error;
    } finally {
        await db.end();
    }
}

async function downloadAndSaveProfilePicture(userId, url) {
    try {
        console.log("URL downloadAndSaveProfilePicture:", url);
        console.log("Downloading profile picture for user ID:", userId);
        const db = await mysql.createConnection(config);
        const userSql = `SELECT Username FROM Users WHERE ID = ?`;
        const [userResult] = await db.query(userSql, [userId]);
        const username = userResult.Username;
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const rootDir = path.resolve(__dirname, '..');
        const filePath = path.join(rootDir, 'uploads', username, `profile_${userId}.jpg`);
        fs.writeFileSync(filePath, response.data);
        console.log(`Profile picture saved to ${filePath}`);
        return `profile_${userId}.jpg`;
    } catch (error) {
        console.error('Error downloading profile picture:', error);
        throw error;
    }
}

   async function findUserByEmail(email) {
       const db = await mysql.createConnection(config);
       try {
           const sql = `SELECT * FROM Users WHERE Email = ?`;
           const [rows] = await db.query(sql, [email]);
           return rows;
       } catch (error) {
           console.error('Error during findUserByEmail:', error);
           throw error;
       } finally {
           await db.end();
       }
   }

// Function to link Google account to existing user
async function linkGoogleAccount(userId, googleId) {
    console.log("Linking Google account to user");
    console.log("userId:", userId);
    console.log("googleId:", googleId);
    const db = await mysql.createConnection(config);

    try {
        const sql = `UPDATE Users SET GoogleID = ? WHERE ID = ?`;
        await db.query(sql, [googleId, userId]);

        // Fetch and return the updated user
        const userSql = `SELECT * FROM Users WHERE ID = ?`;
        const [rows] = await db.query(userSql, [userId]);
        console.log("Updated user:", rows[0]);
        return rows[0];
    } catch (error) {
        console.error('Error in linkGoogleAccount:', error);
        throw error;
    } finally {
        await db.end();
    }
}

// Function to find a user by ID
async function findUserById(id) {
    const db = await mysql.createConnection(config);

    try {
        const sql = `SELECT * FROM Users WHERE ID = ?`;
        let res = await db.query(sql, [id]);

        if (res.length > 0) {
            return res[0];
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error in findUserById:', error);
        throw error;
    } finally {
        await db.end();
    }
}



async function insertFakeData() {
    const db = await mysql.createConnection(config);

    try {
        // Insert 20 users
        for (let i = 1; i <= 20; i++) {
            const username = `user${i}`;
            const email = `user${i}@gmail.com`;
            const passwordHash = `password${i}`; // Just a simple password hash for testing
            const stealthMode = i % 3 === 0; // Every 3rd user has stealth mode on
            const userPFP = `user${i}.jpg`; // A simple profile picture filename

            // Insert the user into the Users table
            const userResult = await db.query(
                `INSERT INTO Users (Username, UserPFP, Email, PasswordHash, StealthMode)
                 VALUES (?, ?, ?, ?, ?)`,
                [username, userPFP, email, passwordHash, stealthMode]
            );
            console.log(`Inserted User ${username}`);

            // Get the inserted user ID
            const userID = userResult[0]?.insertId;

            // Insert 10 boxes for each user
            for (let j = 1; j <= 10; j++) {
                const TitleChosen = `box${j}_user${i}`; // Box label
                const isBoxPublic = j % 2 === 0; // Alternate between public and private boxes
                const nrOfFiles = 10; // Each box has 10 files

                // Insert the box into the Boxes table
                const boxResult = await db.query(
                    `INSERT INTO Boxes (NrOfFiles, UserID, IsBoxPublic, TitleChosen)
                     VALUES (?, ?, ?, ?)`,
                    [nrOfFiles, i, isBoxPublic, TitleChosen]
                );
                console.log(`Inserted Box ${TitleChosen} for User ${username}`);

                // Get the inserted box ID
                const boxID = boxResult[0]?.insertId;

                // Insert 10 media files for each box
                for (let k = 1; k <= 10; k++) {
                    const mediaType = (k % 2 === 0) ? 'jpg' : 'mp3'; // Alternate between image and audio
                    const mediaSize = random(10000, 1000000); // Random size between 100KB and 1MB
                    const mediaPath = `uploads/user${i}/box${j}_user${i}/file${k}.${mediaType}`; // Path for media file

                    // Insert the media file into the BoxMedia table
                    await db.query(
                        `INSERT INTO BoxMedia (BoxID, MediaPath, MediaType, MediaSize)
                         VALUES (?, ?, ?, ?)`,
                        [j*i, mediaPath, mediaType, mediaSize]
                    );
                    console.log(`Inserted Media file${k}.${mediaType} for Box ${TitleChosen}`);
                }
            }
        }

        console.log('Fake data inserted successfully!');
    } catch (error) {
        console.error('Error inserting fake data:', error);
    } finally {
        await db.end();
    }
}

// Call the function to insert the fake data
// insertFakeData();



function hashIP(ip) {
    return crypto.createHash('sha256').update(ip).digest('hex');
}
async function recordPageView(req, pageViewed) {
    const db = await mysql.createConnection(config);
    try {
        const userIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const hashedIP = hashIP(userIP);

        const sql = `INSERT INTO Views (PageViewed, HashedUserIP) VALUES (?, ?)`;
        await db.query(sql, [pageViewed, hashedIP]);
    } catch (error) {
        console.error('Error recording page view:', error);
    } finally {
        await db.end();
    }
}

async function getPageViewCounts(pageViewed) {
    const db = await mysql.createConnection(config);
    try {
        // Get total views for the specific page
        const totalViewsSql = `SELECT COUNT(*) AS totalViews FROM Views WHERE PageViewed = ?`;
        const [totalViewsResult] = await db.query(totalViewsSql, [pageViewed]);
        const totalViews = totalViewsResult.totalViews;

        // Get unique views for the specific page
        const uniqueViewsSql = `SELECT COUNT(DISTINCT HashedUserIP) AS uniqueViews FROM Views WHERE PageViewed = ?`;
        const [uniqueViewsResult] = await db.query(uniqueViewsSql, [pageViewed]);
        const uniqueViews = uniqueViewsResult.uniqueViews;

        // Get total views for the entire website
        const totalSiteViewsSql = `SELECT COUNT(*) AS totalSiteViews FROM Views`;
        const [totalSiteViewsResult] = await db.query(totalSiteViewsSql);
        const totalSiteViews = totalSiteViewsResult.totalSiteViews;

        // Get unique views for the entire website
        const uniqueSiteViewsSql = `SELECT COUNT(DISTINCT HashedUserIP) AS uniqueSiteViews FROM Views`;
        const [uniqueSiteViewsResult] = await db.query(uniqueSiteViewsSql);
        const uniqueSiteViews = uniqueSiteViewsResult.uniqueSiteViews;

        // Return all results
        return {
            totalViews,
            uniqueViews,
            totalSiteViews,
            uniqueSiteViews
        };
    } catch (error) {
        console.error('Error fetching page view counts:', error);
        return null;
    } finally {
        await db.end();
    }
}

async function isUserAdmin(username) {
    const db = await mysql.createConnection(config);
    try {
        const sql = `SELECT IsAdmin FROM Users WHERE Username = ?`;
        const [result] = await db.query(sql, [username]);
        
        if (result && result.IsAdmin) {
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error checking if user is admin:', error);
        return false;
    } finally {
        await db.end();
    }
}

async function getAllTasks() {
    const db = await mysql.createConnection(config);
    try {
        const sql = `SELECT * FROM Tasks ORDER BY Created_at DESC`;
        const tasks = await db.query(sql);
        return tasks;
    } catch (error) {
        console.error('Error fetching all tasks:', error);
        return [];
    } finally {
        await db.end();
    }
}

async function updateTaskStatus(taskId, newStatus, updatedBy) {
    const db = await mysql.createConnection(config);
    try {
        const sql = `UPDATE Tasks SET Status = ?, Moved_at = NOW(), Moved_by = ? WHERE id = ?`;
        const result = await db.query(sql, [newStatus, updatedBy, taskId]);
        return result.affectedRows;
    } catch (error) {
        console.error('Error updating task status:', error);
        return false;
    } finally {
        await db.end();
    }
}

async function addTask(content, createdBy) {
    const db = await mysql.createConnection(config);
    try {
        const sql = `INSERT INTO Tasks (Content, Status, Created_by) VALUES (?, ?, ?)`;
        const result = await db.query(sql, [content, "suggestions", createdBy]);
        console.log(`New task added with ID: ${result.insertId}`);
        return result.insertId;
    } catch (error) {
        console.error('Error adding new task:', error);
        throw error;
    } finally {
        await db.end();
    }
}

async function deleteTask(taskId) {
    const db = await mysql.createConnection(config);
    try {
        const sql = `DELETE FROM Tasks WHERE id = ?`;
        const result = await db.query(sql, [taskId]);
        return result.affectedRows > 0;
    } catch (error) {
        console.error('Error deleting task:', error);
        return false;
    } finally {
        await db.end();
    }
}

// Function to count lines of code in whitelisted folders and files
const countLines = () => {
    // whitelist is all the folders that this function should count
    const whitelist = ['src', 'views', 'routes', 'public', 'index.js', 'sql']; // Add folders that you want to whitelist
    let rootDirectory = __dirname;
    let totalLines = 0;

    // Find the config directory
    while (!fs.existsSync(path.join(rootDirectory, 'config')) && rootDirectory !== '/') {
        rootDirectory = path.dirname(rootDirectory);
    }

    if (rootDirectory === '/') {
        console.error('Config directory not found');
        return 0;
    }

    const readDirectory = (dir, isWhitelisted = false) => {
        const files = fs.readdirSync(dir);
        files.forEach((file) => {
            const filePath = path.join(dir, file);
            const stats = fs.statSync(filePath);

            if (stats.isDirectory()) {
                if (isWhitelisted || whitelist.includes(file)) {
                    readDirectory(filePath, true);
                }
            } else if (stats.isFile()) {
                const ext = path.extname(file);
                if (['.js', '.ejs', '.html', '.css', '.ts'].includes(ext)) { // Adjust extensions as needed
                    if (isWhitelisted || whitelist.includes(file) || whitelist.includes(path.basename(dir))) {
                        const lines = fs.readFileSync(filePath, 'utf-8').split('\n').length;
                        totalLines += lines;
                    }
                }
            }
        });
    };
  
    whitelist.forEach(item => {
        const itemPath = path.join(rootDirectory, item);
        if (fs.existsSync(itemPath)) {
            if (fs.statSync(itemPath).isDirectory()) {
                readDirectory(itemPath, true);
            } else {
                const lines = fs.readFileSync(itemPath, 'utf-8').split('\n').length;
                totalLines += lines;
            }
        }
    });

    console.log(`Total lines of code: ${totalLines}`);
    return totalLines;
    
};


// Function to get boxes shared by the user
async function getSharedBoxesByUser(userID, sortQuery) {
    const db = await mysql.createConnection(config);

    try {
        const sql = `
            SELECT b.*
            FROM Boxes b
            JOIN BoxSharedWith bs ON b.BoxID = bs.BoxID
            WHERE bs.SharedWithUserID = ?
            ${sortQuery}
        `;
        const rows = await db.query(sql, [userID]);
        console.log("rows in getSharedBoxesByUser", rows);
        return rows;
    } catch (error) {
        console.error('Error fetching shared boxes by user:', error);
        throw error;
    } finally {
        await db.end();
    }
}

// Function to get boxes shared with the user
async function getSharedBoxes(userID, sortQuery) {
    const db = await mysql.createConnection(config);

    try {
        const sql = `
            SELECT b.*
            FROM Boxes b
            JOIN BoxSharedWith bs ON b.BoxID = bs.BoxID
            WHERE bs.SharedWithUserID = ?
            ${sortQuery}
        `;
        const rows = await db.query(sql, [userID]);
        console.log("rows in getSharedBoxes", rows);
        return rows;
    } catch (error) {
        console.error('Error fetching boxes shared with user:', error);
        throw error;
    } finally {
        await db.end();
    }
}

// Function to find a box by its name and username
async function findBoxByNameAndUsername(username, boxName) {
    const db = await mysql.createConnection(config);

    try {
        const sql = `
            SELECT b.*
            FROM Boxes b
            JOIN Users u ON b.UserID = u.ID
            WHERE u.Username = ? AND b.TitleChosen = ?
        `;
        const rows = await db.query(sql, [username, boxName]);
        console.log("rows in findBoxByNameAndUsername", rows);
        return rows[0];
    } catch (error) {
        console.error('Error finding box by name and username:', error);
        throw error;
    } finally {
        await db.end();
    }
}

// Function to share a box with a specified user
async function shareBoxWithUser(boxID, shareWith, shareCode) {
    const db = await mysql.createConnection(config);

    try {
        // Find the user to share with
        const userSql = `SELECT ID, Email FROM Users WHERE Username = ?`;
        const userRows = await db.query(userSql, [shareWith]);
        console.log(userRows);
        console.log("userRows in shareboxwithuser");
        if (userRows.length === 0) {
            throw new Error('User to share with not found');
        }
        const sharedWithUserID = userRows[0].ID;
        const sharedWithUserEmail = userRows[0].Email;

        // Insert the share record into the BoxSharedWith table
        const shareSql = `
            INSERT INTO BoxSharedWith (BoxID, SharedWithUserID)
            VALUES (?, ?)
        `;
        await db.query(shareSql, [boxID, sharedWithUserID]);
        // get boxName from boxID
        const boxNameSql = `SELECT TitleChosen FROM Boxes WHERE BoxID = ?`;
        const boxNameResult = await db.query(boxNameSql, [boxID]);
        const boxName = boxNameResult[0].TitleChosen;
        console.log("boxName in shareboxwithuser", boxName);

        const username = shareWith;

        // Prepare the email message
        let emailMessage;
        if (shareCode !== '0') {
            emailMessage = `
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <h2 style="color: #4CAF50;">A box named "<span style="color: #FF5722;">${boxName}</span>" has been shared with you by <span style="color: #2196F3;">${username}</span>.</h2>
                    <p>Login to see the box or use the <strong>Share code: <span style="color: #FF9800;">${shareCode}</span></strong> when opening the box from this link:</p>
                    <a href="http://felixcenusa.com/${username}/${boxName}" style="color: #4CAF50; font-size: 18px;">Open Box</a>
                </div>`;
        } else {
            emailMessage = `
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <h2 style="color: #4CAF50;">A box named "<span style="color: #FF5722;">${boxName}</span>" has been shared with you by <span style="color: #2196F3;">${username}</span>.</h2>
                    <p>The 6-digit code has not been shared. Please ask the user for the code if needed.</p>
                    <a href="http://felixcenusa.com/${username}/${boxName}" style="color: #4CAF50; font-size: 18px;">Open Box</a>
                </div>`;
        }

        // Only send email if shareCode is not "0"
        const mailOptions = {
            from: 'felixdevmailer@gmail.com',
            to: sharedWithUserEmail,
            subject: 'A box has been shared with you!',
            html: emailMessage
        };

        await transporter.sendMail(mailOptions);

    } catch (error) {
        console.error('Error sharing box with user:', error);
        throw error;
    } finally {
        await db.end();
    }
}

async function getAllUsernames() {
    const db = await mysql.createConnection(config);
    try {
        const sql = `SELECT Username FROM Users`;
        const rows = await db.query(sql);
        const usernames = [];
        for (const row of rows) {
            usernames.push(row.Username);
        }
        return usernames;
    } catch (error) {
        console.error('Error fetching all usernames:', error);
        return [];
    } finally {
        await db.end();
    }
}


async function isBoxAlreadySharedWithUser(boxID, shareWith) {
    const db = await mysql.createConnection(config);

    try {
        const sql = `
            SELECT COUNT(*) AS count
            FROM BoxSharedWith
            WHERE BoxID = ? AND SharedWithUserID = (
                SELECT ID FROM Users WHERE Username = ?
            )
        `;
        const rows = await db.query(sql, [boxID, shareWith]);
        return rows[0].count > 0;
    } catch (error) {
        console.error('Error checking if box is already shared with user:', error);
        return false;
    } finally {
        await db.end();
    }
}

async function updateUsername(userId, newUsername) {
    const db = await mysql.createConnection(config);
    try {
        // Check if the new username is restricted
        const restrictedUsernames = [
            'admin', 'felix', 'felixcenusa', 'felixcen', 'TimeToMove', 'timetomove', 'timetomoveofficial', 'timetomoveofficialcom',
            'updateUsername', 'kanban', 'delete-task', 'leaderboard', 'sharedWithYou', 'youShared', 'share', 'profiles', 'about', 
            'login', 'register', 'labelStyles', 'settings', 'privacyPolicy', 'termsOfService', 'contact', 
            'help', 'faq', 'privacy', 'cookie', 'security', 'dmca', 'copyright', 'legal', 'imprint', 
            'disclaimer', 'privacy-policy', 'terms-of-service', 'contact-us', 'help-support', 'faq-page', 
            'privacy-settings', 'cookie-settings', 'security-settings', 'dmca-notice', 'copyright-notice',
             'legal-notice', 'imprint-notice', 'disclaimer-notice'
        ];
        
        if (restrictedUsernames.includes(newUsername.toLowerCase())) {
            console.error('Username is restricted:', newUsername);
            return { success: false, message: 'This username is not allowed.' };
        }

        // Check if the new username is already taken
        const checkSql = `SELECT COUNT(*) AS count FROM Users WHERE Username = ?`;
        const checkResult = await db.query(checkSql, [newUsername]);
        if (checkResult.count > 0) {
            console.error('Username already taken:', newUsername);
            return false;
        }

        // Update the username if not taken
        const updateSql = `UPDATE Users SET Username = ? WHERE ID = ?`;
        await db.query(updateSql, [newUsername, userId]);
        return true;
    } catch (error) {
        console.error('Error updating username:', error);
        return false;
    } finally {
        await db.end();
    }
}

// Function to delete a user by username
async function deleteUserByUsername(username) {
    const db = await mysql.createConnection(config);
    try {
        // Find all box contents and delete them
        const deleteBoxContentsSql = `
            DELETE bm FROM BoxMedia bm
            JOIN Boxes b ON bm.BoxID = b.BoxID
            JOIN Users u ON b.UserID = u.ID
            WHERE u.Username = ?`;
        await db.query(deleteBoxContentsSql, [username]);

        // Delete all boxes shared to and from this user
        const deleteSharedBoxesSql = `
            DELETE bs FROM BoxSharedWith bs
            JOIN Boxes b ON bs.BoxID = b.BoxID
            JOIN Users u ON b.UserID = u.ID
            WHERE u.Username = ? OR bs.SharedWithUserID = (SELECT ID FROM Users WHERE Username = ?)`;
        await db.query(deleteSharedBoxesSql, [username, username]);

        // Delete all associated boxes
        const deleteBoxesSql = `
            DELETE b FROM Boxes b
            JOIN Users u ON b.UserID = u.ID
            WHERE u.Username = ?`;
        await db.query(deleteBoxesSql, [username]);

        // Delete the user
        const deleteUserSql = `DELETE FROM Users WHERE Username = ?`;
        await db.query(deleteUserSql, [username]);

        return true;
    } catch (error) {
        console.error('Error deleting user:', error);
        return false;
    } finally {
        await db.end();
    }
}

// Function to send a delete confirmation email
async function sendDeleteConfirmationEmail(email, username) {
    console.log("email in sendDeleteConfirmationEmail", email);
    console.log("username in sendDeleteConfirmationEmail", username);
    const db = await mysql.createConnection(config);
    try {
        // Generate a security code
        const securityCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Prepare the email message
        const emailMessage = `
            <p>Hello <strong>${username}</strong>,</p>
            <p>Please confirm your account deletion by clicking the link below:</p>
            <p><a href="http://felixcenusa.com/${username}/confirmDelete?code=${securityCode}">Confirm Account Deletion</a></p>
            <p style="color: red; font-size: 18px;"><strong>Warning:</strong> This action <u>cannot be undone</u> and will delete all contents uploaded and all data stored in this user.</p>
            <p>If you did not request this, please ignore this email.</p>
        `;

        // Send the email
        const mailOptions = {
            from: 'felixdevmailer@gmail.com',
            to: email,
            subject: 'Account Deletion Confirmation',
            html: emailMessage
        };

        await transporter.sendMail(mailOptions);
        return securityCode;
    } catch (error) {
        console.error('Error sending delete confirmation email:', error);
        throw error;
    } finally {
        await db.end();
    }
}   





module.exports = {
    createUser,
    getAllUsers,
    sendVerificationEmail,
    loginUser,
    verify,
    getUserBoxes,
    getUserByUsername,
    getBoxByID,
    getBoxContents,
    insertMediaIntoBox,
    getLeaderboardData,
    getLeaderboardStats,
    deleteMedia,
    renameBox,
    getBoxID,
    deleteBoxWithContents,
    getBoxByIDONLY,
    createFakeUser,
    fakeVerify,
    updateUserDescription,
    updateBox,
    updateUserProfilePic,
    sendEmail,
    generatePasswordResetToken,
    sendResetPasswordEmail,
    resetPassword,
    recordPageView,
    getPageViewCounts,
    getUserProfilePic,
    deleteUser,
    findOrCreateGoogleUser,
    findUserById,
    isUserAdmin,
    getAllTasks,
    updateTaskStatus,
    addTask,
    deleteTask,
    countLines,
    findUserByEmail,
    linkGoogleAccount,
    loginUserWithGoogle,
    updateUserProfilePicture,
    getSharedBoxesByUser,
    getSharedBoxes,
    findBoxByNameAndUsername,
    shareBoxWithUser,
    getAllUsernames,
    isBoxAlreadySharedWithUser,
    updateUsername,
    deleteUserByUsername,
    sendDeleteConfirmationEmail,
    "createBox": createBox,
    "addToBox": addToBox,
    "getBoxMedia": getBoxMedia,
    "updateStealthMode": updateStealthMode,
    "logVisit": logVisit,
    "getPublicLeaderboard": getPublicLeaderboard
};
