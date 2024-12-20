const express = require("express");
const TimeToMove = require("../src/TimeToMove.js");
const multer = require('multer');
const path = require('path');
const router = express.Router();
const fs = require('fs');
const archiver = require('archiver');
const QRCode = require('qrcode'); // Using qrcode without canvas
const sanitizeHtml = require('sanitize-html');
const passport = require('passport');
const crypto = require('crypto');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const { marked } = require('marked');

// Middleware to check if the user is an admin by querying the database
async function isAdmin(req, res, next) {
    if (!req.session.user) {
        return res.status(403).send('Forbidden - You are not logged in');
    }

    try {
        // Fetch the user's admin status from the database
        const user = await TimeToMove.getUserByID(req.session.user.id);
        if (user && user.IsAdmin) {
            next(); // User is admin, allow access
        } else {
            res.status(403).send('Forbidden - You are not an admin');
        }
    } catch (error) {
        console.error('Error checking admin status:', error);
        res.status(500).send('Error checking admin status');
    }
}
router.get('/readme', async (req, res) => {
    const readmePath = path.join(__dirname, '..', 'readme.md');
    // Record the page view
    await TimeToMove.recordPageView(req, '/statistics');

    // Retrieve the view counts
    const viewCounts = await TimeToMove.getPageViewCounts('/statistics');
    fs.readFile(readmePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading README.md:', err);
            return res.status(500).send('Error reading README.md');
        }

        // Convert Markdown to HTML
        const readmeHTML = marked(data);

        // Render the EJS template with the HTML content
        res.render('TimeToMove/readme.ejs', { readmeContent: readmeHTML, session: req.session, viewCounts });
    });
});

router.get('/zzz', async (req, res) => {
    // Record the page view
    await TimeToMove.recordPageView(req, '/newfiletest');
    // Retrieve the view counts
    const viewCounts = await TimeToMove.getPageViewCounts('/newfiletest');
    res.render('TimeToMove/zzz.ejs', { session: req.session, viewCounts });
});

router.get('/statistics', async (req, res) => {
    try {
        // Fetch the leaderboard data and statistics from TimeToMove.js
        const { leaderboard, totalFilesUploaded, totalMediaSize, totalUsers, totalLinesOfCode } = await TimeToMove.getLeaderboardStats();

        // Record the page view
        await TimeToMove.recordPageView(req, '/statistics');

        // Retrieve the view counts
        const viewCounts = await TimeToMove.getPageViewCounts('/statistics');

        // Retrieve uptime statistics
        const uptimeStats = await TimeToMove.getUptimeStatistics();

        // Render the statistics page with the fetched stats
        res.render('TimeToMove/statistics.ejs', {
            session: req.session,
            viewCounts,
            uptimeStats,
            leaderboard,
            totalFilesUploaded,
            totalMediaSize,
            totalUsers,
            totalLinesOfCode
        });
    } catch (error) {
        console.error('Error loading statistics:', error);
        res.status(500).send('Error loading statistics.');
    }
});

// Photography page route
router.get('/photography', async (req, res) => {
    // Record the page view
    await TimeToMove.recordPageView(req, '/photography');

    // Check admin status
    let isAdmin = false;
    if (req.session.user) {
        isAdmin = await TimeToMove.isUserAdmin(req.session.user.username);
    }

    // Fetch photography box
    const photographyBox = await TimeToMove.createOrGetBox('photography');

    // Use the current `getBoxMedia` function to retrieve all media
    const media = await TimeToMove.getBoxMedia(photographyBox.BoxID);

    // Pass only images to the view
    const photos = media.images;

    res.render('TimeToMove/PhotographyTemp', {
        session: req.session,
        isAdmin,
        photos
    });
});

// Upload photos for photography
router.post('/photography/upload', upload.array('photos', 10), async (req, res) => {
    try {
        if (!req.session.user || !(await TimeToMove.isUserAdmin(req.session.user.username))) {
            return res.status(403).send('Access denied');
        }

        const photographyBox = await TimeToMove.createOrGetBox('photography');
        const boxID = photographyBox.BoxID;

        // Insert each uploaded file into the BoxMedia table
        for (const file of req.files) {
            await TimeToMove.insertMediaIntoBox(boxID, path.join('photography', file.filename), 'image');
        }

        res.redirect('/photography');
    } catch (err) {
        console.error('Error uploading photos:', err);
        res.status(500).send('Error uploading photos');
    }
});


// make a route for architecture
router.get('/architecture', async (req, res) => {
    // Record the page view
    await TimeToMove.recordPageView(req, '/architecture');
    // Retrieve the view counts
    const viewCounts = await TimeToMove.getPageViewCounts('/architecture');
    // Render the page and pass the view counts
    res.render('TimeToMove/architecture.ejs', { session: req.session, viewCounts });
});

// Admin route protected by isAdmin middleware
router.get('/admin', isAdmin, async (req, res) => {
    // Record the page view
    await TimeToMove.recordPageView(req, '/admin');
    // Retrieve the view counts
    const viewCounts = await TimeToMove.getPageViewCounts('/admin');
    try {
        // Fetch all users (or other admin-specific data)
        const users = await TimeToMove.getAllUsersAndDetails(); 
        res.render('TimeToMove/ADMIN.ejs', { users, session: req.session, viewCounts });
    } catch (error) {
        console.error('Error loading admin page:', error);
        res.status(500).send('Error loading admin dashboard.');
    }
});

router.post('/admin/deleteUser', isAdmin, async (req, res) => {
    const { userID } = req.body;

    try {
        const result = await TimeToMove.deleteUserByID(userID);
        console.log("result delete user", result);
        res.redirect('/admin');
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).send('Error deleting user.');
    }
});

router.post('/admin/sendEmail', isAdmin, async (req, res) => {
    const { recipients, subject, message } = req.body;

    try {
        let emails = [];

        if (recipients === 'all') {
            // Fetch all user emails
            const users = await TimeToMove.getAllUserEmails();
            emails = users.map(user => user.Email);
        } else {
            emails.push(recipients); // Single email selected
        }

        // Send emails and track the success
        let success = true;
        for (const email of emails) {
            const sent = await TimeToMove.sendEmail(email, subject, message);
            if (!sent) {
                success = false; // If any email fails, mark as failure
                break;
            }
        }

        // If all emails were sent successfully, pass success message
        if (success) {
            res.render('TimeToMove/ADMIN.ejs', { 
                message: 'Emails were sent successfully!', 
                messageType: 'success', 
                users: await TimeToMove.getAllUsers(), // Pass user data
                session: req.session
            });
        } else {
            res.render('TimeToMove/ADMIN.ejs', { 
                message: 'Failed to send some or all emails.', 
                messageType: 'error',
                users: await TimeToMove.getAllUsers(),
                session: req.session
            });
        }
    } catch (error) {
        console.error('Error sending emails:', error);
        res.render('TimeToMove/ADMIN.ejs', { 
            message: 'Error occurred while sending emails.', 
            messageType: 'error',
            users: await TimeToMove.getAllUsers(),
            session: req.session
        });
    }
});





router.post('/updateUsername', async (req, res) => {
    const { newUsername } = req.body;
    const userId = req.session.user.id; // Assuming user ID is stored in session

    try {
        // Update the username in the database
        const result = await TimeToMove.updateUsername(userId, newUsername);

        if (result) {
            const oldUsername = req.session.user.username;
            // Update the session with the new username
            req.session.user.username = newUsername;
            // Update the uploads/username directory
            const oldUploadsDir = path.join(__dirname, '..', 'uploads', oldUsername);
            const newUploadsDir = path.join(__dirname, '..', 'uploads', newUsername);
            if (fs.existsSync(oldUploadsDir)) {
                fs.renameSync(oldUploadsDir, newUploadsDir);
            }

            // Redirect to the profile page with a success message
            res.redirect(`/${newUsername}?success=Username updated successfully`);
        } else {
            // Handle case where update fails
            res.status(400).send('Failed to update username, username already taken or username is restricted');
        }
    } catch (error) {
        console.error('Error updating username:', error);
        res.status(500).send('Error updating username');
    }
});

// add a route for the kanban board
router.get('/kanban', async (req, res) => {
    // Record the page view
    await TimeToMove.recordPageView(req, '/kanban');
    // Retrieve the view counts
    const viewCounts = await TimeToMove.getPageViewCounts('/kanban');
    // Check if the user is an admin
    let isAdmin = false;
    if (req.session.user) {
        isAdmin = await TimeToMove.isUserAdmin(req.session.user.username);
    }
    console.log("isAdmin", isAdmin);
    // Render the page and pass the view counts and admin status
    const tasks = await TimeToMove.getAllTasks();
    res.render('TimeToMove/kanban', { 
        session: req.session, 
        viewCounts,
        isAdmin,
        tasks
    });
});

router.post('/delete-task', async (req, res) => {
    // Check if the user is logged in and is an admin
    if (!req.session.user || !(await TimeToMove.isUserAdmin(req.session.user.username))) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const { taskId } = req.body;
    try {
        const success = await TimeToMove.deleteTask(taskId);
        if (success) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Task not found or could not be deleted' });
        }
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: 'Failed to delete task' });
    }
});


router.get('/get-tasks', async (req, res) => {
    const tasks = await TimeToMove.getAllTasks();
    res.json(tasks[0]);
});

router.post('/update-task-status', async (req, res) => {
    // Check if the user is logged in and is an admin
    if (!req.session.user || !(await TimeToMove.isUserAdmin(req.session.user.username))) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const { taskId, newStatus } = req.body;
    const updatedBy = req.session.user.username;
    try {
        const sanitizedStatus = sanitizeHtml(newStatus, {
            allowedTags: [],
            allowedAttributes: {}
        });
        const success = await TimeToMove.updateTaskStatus(taskId, sanitizedStatus, updatedBy);
        if (success) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Task not found or status not updated' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update task status' });
    }
});

router.post('/add-task', async (req, res) => {
    if (!req.session.user) {
        return res.status(403).json({ error: 'Login to add a task' });
    }

    const { content } = req.body;
    const createdBy = req.session.user.username;
    console.log("content", content);
    console.log("createdBy", createdBy);

    try {
        const sanitizedContent = sanitizeHtml(content, {
            allowedTags: ['b', 'i', 'em', 'strong', 'a'],
            allowedAttributes: {
                'a': ['href']
            }
        });
        const taskId = await TimeToMove.addTask(sanitizedContent, createdBy);
        res.json({ success: true, taskId });
    } catch (error) {
        console.error('Error adding task:', error);
        res.status(500).json({ error: 'Failed to add task' });
    }
});

// // Initiate authentication with Google
// router.get('/auth/google',
//     passport.authenticate('google', { scope: ['profile', 'email'] })
// );

// Initiate authentication with Google
router.get('/auth/google',
    passport.authenticate('google', {
        scope: ['profile', 'email']
        //,prompt: 'select_account' // Force & Prompt account selection
    })
);

// Handle callback after Google has authenticated the user
router.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        // Successful authentication, set up session and redirect to profile
        console.log("req.user google callback", req.user);
        if (req.user && req.user.username) {
            // Store user information in session
            req.session.user = {
                id: req.user.id,
                username: req.user.username
            };
            // Save the session
            req.session.save((err) => {
                if (err) {
                    console.error('Error saving session:', err);
                    return res.redirect('/login');
                }
                res.redirect(`/${req.user.username}`);
            });
        } else {
            console.error('User object does not have a username:', req.user);
            res.redirect('/login'); // Redirect to login or an error page
        }
    }
);


// Route for Terms and Conditions
router.get('/terms', async (req, res) => {
    // Record the page view
    await TimeToMove.recordPageView(req, '/terms');
    // Retrieve the view counts
    const viewCounts = await TimeToMove.getPageViewCounts('/terms');
    // Render the page and pass the view counts
    // async         viewCounts
    res.render('TimeToMove/terms',{ session: req.session, viewCounts });
});

// Route for Privacy Policy
router.get('/privacyPolicy', async (req, res) => {
    // Record the page view
    await TimeToMove.recordPageView(req, '/privacyPolicy');
    // Retrieve the view counts
    const viewCounts = await TimeToMove.getPageViewCounts('/privacyPolicy');
    // Render the page and pass the view counts
    res.render('TimeToMove/privacyPolicy', { session: req.session, viewCounts });
});


// Route for Contact Us
router.get('/contact', async(req, res) => {
    // Record the page view
    await TimeToMove.recordPageView(req, '/contact');
    // Retrieve the view counts
    const viewCounts = await TimeToMove.getPageViewCounts('/contact');
    // Render the page and pass the view counts
    // async         viewCounts
    res.render('TimeToMove/contact',{ session: req.session,viewCounts });
});

// Route for Contact Us
router.get('/security', async(req, res) => {
    // Record the page view
    await TimeToMove.recordPageView(req, '/security');
    // Retrieve the view counts
    const viewCounts = await TimeToMove.getPageViewCounts('/security');
    // Render the page and pass the view counts
    // async         viewCounts
    res.render('TimeToMove/security',{ session: req.session,viewCounts });
});

// Route to handle Contact form submission
router.post('/submit_contact', async (req, res) => {
    let { name, email, message, 'g-recaptcha-response': recaptchaResponse } = req.body;
    console.log('reCAPTCHA response:', recaptchaResponse);
    // Sanitize inputs to remove any potential HTML/JS
    name = sanitizeHtml(name);
    email = sanitizeHtml(email);
    message = sanitizeHtml(message);

    // Verify reCAPTCHA
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    const verificationURL = `https://www.google.com/recaptcha/api/siteverify`;

    try {
        const params = new URLSearchParams();
        params.append('secret', secretKey);
        params.append('response', recaptchaResponse);

        const response = await axios.post(verificationURL, params);
        const { success, 'error-codes': errorCodes } = response.data;

        if (!success) {
            console.error('reCAPTCHA verification failed:', errorCodes);
            return res.status(400).json({ success: false, message: 'Failed CAPTCHA verification. Please try again.' });
        }
    } catch (error) {
        console.error('Error verifying reCAPTCHA:', error);
        return res.status(500).json({ success: false, message: 'Error verifying reCAPTCHA.' });
    }

    // Send email using the email service
    const emailSent = await TimeToMove.sendEmailContact(name, email, message);

    if (emailSent) {
        // Return JSON response for success
        res.json({ success: true, message: 'Email sent successfully' });
    } else {
        // Return JSON response for failure
        res.status(500).json({ success: false, message: 'Failed to send email' });
    }
});


router.get("/create_user", async (req, res) => {
    // Record the page view
    await TimeToMove.recordPageView(req, '/create_user');
    // Retrieve the view counts
    const viewCounts = await TimeToMove.getPageViewCounts('/create_user');
    // Render the page and pass the view counts
    // async         viewCounts
    return res.render('TimeToMove/register.ejs',{ session: req.session,viewCounts })
});

router.post('/create_user', async (req, res) => {
    let { username, email, password, 'g-recaptcha-response': recaptchaResponse } = req.body;
    console.log('recaptchaResponse:', recaptchaResponse);

    // Sanitize inputs to remove any potential HTML/JS
    username = sanitizeHtml(username);
    email = sanitizeHtml(email);
    password = sanitizeHtml(password);

    // Verify reCAPTCHA
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    const verificationURL = `https://www.google.com/recaptcha/api/siteverify`;

    try {
        const params = new URLSearchParams();
        params.append('secret', secretKey);
        params.append('response', recaptchaResponse);
        // Optionally, include the user's IP address
        // params.append('remoteip', req.connection.remoteAddress);

        const response = await axios.post(verificationURL, params);
        console.log('Google reCAPTCHA response:', response.data);


        const { success, 'error-codes': errorCodes } = response.data;


        if (!success) {
            console.error('reCAPTCHA verification failed:', errorCodes);
            return res.status(400).render('TimeToMove/register.ejs', {
                errorMessage: 'Failed CAPTCHA verification. Please try again.',
                session: req.session,
                viewCounts: {},
                data: {}
            });
        }
    } catch (error) {
        console.error('Error verifying reCAPTCHA:', error);
        return res.status(500).send('Error verifying reCAPTCHA.');
    }

    // Proceed with the original registration logic
    // Create filepath /uploads/username
    const uploadDir = path.join(__dirname, '..', 'uploads', username);
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    let data = {};
    try {
        data.lastUpdated = fs.readFileSync(path.join(__dirname, '..', 'lastUpdated.md'), 'utf8');
    } catch (error) {
        console.error('Error reading lastUpdated.md:', error);
        data.lastUpdated = 'Error loading last updated date.';
    }

    try {
        // Call the createUser function to generate the token and send email
        const result = await TimeToMove.createUser(username, email, password);

        if (result.success) {
            // Redirect the user to the /verify route after email is sent
            return res.redirect('/verify');
        } else {
            // Handle error (e.g., username or email already exists)
            return res.render('TimeToMove/register.ejs', {
                errorMessage: result.message,
                session: req.session,
                data
            });
        }
    } catch (error) {
        console.error('Error during registration:', error);
        return res.status(500).send('Error during registration.');
    }
});

//  
//     return res.render('TimeToMove/fakeRegister.ejs',{ session: req.session })
// });

// router.post('/create_fake_user', async (req, res) => {
//     const { username, email, password, isPublic } = req.body;
    
//     try {
//         // Call the createFAKKEEEUser function to generate the token and send email
//         const result = await TimeToMove.createFakeUser(username, email, password, isPublic === 'true');

//         if (result.success) {
//             // Redirect the user to the /verify route after email is sent
//             return res.redirect('/fakeVerify');
//         } else {
//             // Handle error (e.g., username or email already exists)
//             return res.render('TimeToMove/index.ejs', { errorMessage: result.message, session: req.session });
//         }
//     } catch (error) {
//         console.error('Error during registration:', error);
//         return res.status(500).send('Error during registration.');
//     }
// });

// router.get('/fakeVerify', (req, res) => {
//     // Render the verify page where the user will input the token
//     res.render('TimeToMove/fakeVerify.ejs',{ user: req.session.user,session: req.session });  // Render a view for token input
// });

// // Route to handle token verification
// router.post('/fakeVerify', async (req, res) => {
//     const { token } = req.body;

//     try {
//         // Call the verify function in TimeToMove.js
//         const result = await TimeToMove.fakeVerify(token);

//         if (result.success) {
//             return res.redirect('/login');
//         } else {
//             //res.status(400).send(result.message);  // Send error message
//             return res.redirect('/create_fake_user');
//         }
//     } catch (error) {
//         console.error('Error during verification:', error);
//         res.status(500).send('Server error during verification.');
//     }
// });

router.get('/', async (req, res) => {
    const isLoggedIn = !!req.session.user;  // Check if the user is logged in
    // get the contents from wthe lastUpdated.md file and send the data to the index.ejs
    let data = {};
    // Record the page view
    await TimeToMove.recordPageView(req, '/');
    // Retrieve the view counts
    const viewCounts = await TimeToMove.getPageViewCounts('/');
    // Render the page and pass the view counts
    // async         viewCounts
    try {
        data.lastUpdated = fs.readFileSync(path.join(__dirname, '..', 'lastUpdated.md'), 'utf8');
    } catch (error) {
        console.error('Error reading lastUpdated.md:', error);
        data.lastUpdated = 'Error loading last updated date.';
    }
    

    res.render('TimeToMove/index.ejs', { user: req.session.user,session: req.session, data, viewCounts });
});


// Route to handle verification via URL (with token in query params)
router.get('/verify', async (req, res) => {
    const token = req.query.token; // Get the token from the query string
    // Record the page view
    await TimeToMove.recordPageView(req, '/verify');
    // Retrieve the view counts
    const viewCounts = await TimeToMove.getPageViewCounts('/verify');
    // Render the page and pass the view counts
    // async         viewCounts

    if (token) {
        const result = await TimeToMove.verify(token); // Automatically verify the token
        if (result.success) {
            // If successful, redirect to the login page
            return res.redirect('/login');
        } else {
            // If failed, redirect to the register page (/create_user)
            return res.redirect('/create_user');
        }
    } else {
        // Render the verify page if no token is provided
        return res.render('TimeToMove/verify.ejs', { user: req.session.user, session: req.session, viewCounts });
    }
});

// Route to handle verification form submission (POST)
router.post('/verify', async (req, res) => {
    const { token } = req.body; // Get the token from the form
    const result = await TimeToMove.verify(token);
    
    
    if (result.success) {
        return res.json({ success: true, message: result.message });
    } else {
        return res.json({ success: false, message: result.message });
    }
});






// Display the login form
router.get('/login', async (req, res) => {
    // Record the page view
    await TimeToMove.recordPageView(req, '/login');
    // Retrieve the view counts
    const viewCounts = await TimeToMove.getPageViewCounts('/login');
    // Render the page and pass the view counts
    // async         viewCounts
    res.render('TimeToMove/login.ejs', { errorMessage: "" ,session: req.session,viewCounts});
});

router.post('/login', async (req, res) => {
    let { username, password, 'g-recaptcha-response': recaptchaResponse } = req.body;

    // Sanitize inputs
    username = sanitizeHtml(username);
    password = sanitizeHtml(password);

    // Verify reCAPTCHA
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    const verificationURL = `https://www.google.com/recaptcha/api/siteverify`;

    try {
        // Send POST request with form data
        const params = new URLSearchParams();
        params.append('secret', secretKey);
        params.append('response', recaptchaResponse);
        // Optionally, include the user's IP address
        // params.append('remoteip', req.connection.remoteAddress);

        const response = await axios.post(verificationURL, params);

        const { success, 'error-codes': errorCodes } = response.data;

        if (!success) {
            console.error('reCAPTCHA verification failed:', errorCodes);
            return res.render('TimeToMove/login.ejs', { errorMessage: 'Failed CAPTCHA verification. Please try again.', session: req.session });
        }

        // Proceed with login logic if reCAPTCHA is successful
        const result = await TimeToMove.loginUser(username, password);

        if (result.success) {
            // Store the user's information in the session
            req.session.user = {
                id: result.userId,
                username: result.username
            };

            // Update the LastLoggedIn timestamp
            await TimeToMove.updateLastLoggedIn(result.userId);

            // Redirect the user to their profile page (e.g., /username)
            return res.redirect(`/${result.username}`);
        } else {
            return res.render('TimeToMove/login.ejs', { errorMessage: result.message, session: req.session });
        }
    } catch (error) {
        console.error('Error during login:', error);
        return res.status(500).send('Error during login.');
    }
});



// Display the forgot password form
router.get('/forgotPassword', async (req, res) => {
    // Record the page view
    await TimeToMove.recordPageView(req, '/forgotPassword');
    // Retrieve the view counts
    const viewCounts = await TimeToMove.getPageViewCounts('/forgotPassword');
    // Render the page and pass the view counts
    // async         viewCounts
    res.render('TimeToMove/forgotPassword.ejs', { session: req.session,viewCounts });
});

// Handle forgot password form submission
router.post('/forgotPassword', async (req, res) => {
    let { email } = req.body;
    email = sanitizeHtml(email);
    try {
        // Check if the email exists and generate a reset token along with the username
        const result = await TimeToMove.generatePasswordResetToken(email);

        if (result.success) {
            // Send an email with the password reset link, including the username
            await TimeToMove.sendResetPasswordEmail(email, result.token, result.username);

            // Redirect to the resetPasswordSent page with a success message
            return res.redirect(`/resetPasswordSent?message=Password reset link has been sent to your email.`);
        } else {
            return res.render('TimeToMove/forgotPassword.ejs', { errorMessage: result.message, session: req.session });
        }
    } catch (error) {
        console.error('Error during forgot password process:', error);
        return res.status(500).send('Error during password reset.');
    }
});


// Route to display the success message after sending reset password email
router.get('/resetPasswordSent', async (req, res) => {
    // Record the page view
    await TimeToMove.recordPageView(req, '/resetPasswordSent');
    // Retrieve the view counts
    const viewCounts = await TimeToMove.getPageViewCounts('/resetPasswordSent');
    // Render the page and pass the view counts
    // async         viewCounts
    const message = req.query.message;  // Get the message from the query string
    res.render('TimeToMove/resetPasswordSent.ejs', { message, session: req.session, viewCounts });
});


// Display the reset password form
router.get('/resetPassword', async (req, res) => {
    // Record the page view
    await TimeToMove.recordPageView(req, '/resetPassword');
    // Retrieve the view counts
    const viewCounts = await TimeToMove.getPageViewCounts('/resetPassword');
    // Render the page and pass the view counts
    // async         viewCounts
    const token = req.query.token; // Get the token from the query string
    res.render('TimeToMove/resetPassword.ejs', { token, session: req.session, viewCounts });
});

// Handle reset password form submission
router.post('/resetPassword', async (req, res) => {
    let { token, password } = req.body;
    password = sanitizeHtml(password);

    try {
        const result = await TimeToMove.resetPassword(token, password);
        if (result.success) {
            return res.redirect('/login');
        } else {
            return res.render('TimeToMove/resetPassword.ejs', { errorMessage: result.message, session: req.session });
        }
    } catch (error) {
        console.error('Error during password reset:', error);
        res.status(500).send('Error during password reset.');
    }
});
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Error logging out.');
        }
        res.redirect('/login');  // Redirect to the login page after logging out
    });
});



// Set up company logo storage engine
const companyLogoStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/companyLogos'); // Ensure this directory exists
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // Append timestamp to avoid name conflicts
    }
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/jpg', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPG, PNG, and GIF are allowed.'));
    }
};

// Initialize upload middleware for company logos
const uploadCompanyLogo = multer({
    storage: companyLogoStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
    fileFilter: fileFilter
}).single('companyLogo');



router.post('/create_box', async (req, res) => {
    // Check if the user is logged in
    if (!req.session.user) {
        return res.redirect('/login');
    }

    // Handle file upload
    uploadCompanyLogo(req, res, async function (err) {
        if (err) {
            console.error('Error uploading company logo:', err);
            return res.status(400).send(err.message);
        }

        let {
            label,
            isPublic,
            labelStyleUrl,
            borderImageSlice,
            borderImageRepeat,
            isInsuranceLabel,
            currency,
            itemList,
            itemValues,
            withDigitCode
        } = req.body;
        console.log("req.body in create_box", req.body);
        let userId = req.session.user.id;

        // Sanitize inputs
        label = sanitizeHtml(label);
        labelStyleUrl = sanitizeHtml(labelStyleUrl);
        borderImageSlice = sanitizeHtml(borderImageSlice);
        borderImageRepeat = sanitizeHtml(borderImageRepeat);
        userId = sanitizeHtml(userId);
        isInsuranceLabel = isInsuranceLabel === 'true';
        currency = sanitizeHtml(currency);
        itemList = sanitizeHtml(itemList);
        itemValues = sanitizeHtml(itemValues);
        withDigitCode = sanitizeHtml(withDigitCode);

        // Convert item values to numbers and validate
        const items = itemList ? itemList.split('\n').map(item => item.trim()).filter(item => item) : [];
        const values = itemValues ? itemValues.split('\n').map(value => parseFloat(value)).filter(value => !isNaN(value)) : [];

        if (isInsuranceLabel && items.length !== values.length) {
            return res.status(400).send('Number of items and values do not match.');
        }

        // Get the company logo filename if uploaded
        let companyLogoPath = null;
        if (req.file) {
            companyLogoPath = req.file.filename;
        }

        try {
            if (isInsuranceLabel) {
                // Create a box for each item-value pair
                for (let i = 0; i < items.length; i++) {
                    await TimeToMove.createBox({
                        userId,
                        isPublic: isPublic === 'true',
                        label: `${label} - ${items[i]}`,
                        labelStyleUrl,
                        borderImageSlice,
                        borderImageRepeat,
                        isInsuranceLabel,
                        currency,
                        companyLogoPath,
                        itemsJson: JSON.stringify([items[i]]),
                        valuesJson: JSON.stringify([values[i]]),
                        titleChosen: null, // Pass null to trigger default title generation
                        withDigitCode
                    });
                }
            } else {
                // Create a single box without insurance details
                await TimeToMove.createBox({
                    userId,
                    isPublic: isPublic === 'true',
                    label,
                    labelStyleUrl,
                    borderImageSlice,
                    borderImageRepeat,
                    isInsuranceLabel,
                    titleChosen: label,
                    withDigitCode
                });
            }

            // Redirect back to the account page after creating the box(es)
            res.redirect(`/${req.session.user.username}`);
        } catch (error) {
            console.error('Error creating box(es):', error);
            res.status(500).send('Error creating box(es).');
        }
    });
});

// Route to handle label style upload
const labelStyleStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '..', 'uploads', 'labelStyles');
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const filename = Date.now() + '_' + file.originalname;
        cb(null, filename);
    }
});

const uploadLabelStyle = multer({
    storage: labelStyleStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPG, PNG, and GIF are allowed.'));
        }
    }
}).single('newLabelStyle');

router.post('/upload_label_style', function (req, res) {
    // Ensure the user is logged in
    if (!req.session.user) {
        return res.status(403).send('Unauthorized');
    }

    uploadLabelStyle(req, res, function (err) {
        if (err) {
            console.error('Error uploading label style:', err);
            return res.status(400).send(err.message);
        }

        // After successful upload, redirect back to the user's profile
        res.redirect(`/${req.session.user.username}`);
    });
});






router.get('/leaderboard', async (req, res) => { 
    try {
        // Fetch the leaderboard data and statistics from TimeToMove.js
        const { leaderboard, totalFilesUploaded, totalMediaSize, totalUsers, totalLinesOfCode } = await TimeToMove.getLeaderboardStats();

        // Record the page view
        await TimeToMove.recordPageView(req, '/leaderboard');

        // Retrieve the view counts
        const viewCounts = await TimeToMove.getPageViewCounts('/leaderboard');

        // Render the leaderboard page with the fetched stats
        res.render('TimeToMove/leaderboard', { 
            user: req.session.user,
            session: req.session,
            leaderboard,
            totalFilesUploaded,
            totalMediaSize,
            totalUsers,
            viewCounts,
            totalLinesOfCode 
        });
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        res.status(500).send('Error loading leaderboard.');
    }
});

// Enable account
router.get('/:username/enableAccount', async (req, res) => {
    // Enable the account
    await TimeToMove.enableAccount(req.params.username);
    // Render the page and pass the view counts
    res.render('TimeToMove/enableAccount', { 
        session: req.session, 
        username: req.params.username
    });
});

// Disable account
router.get('/:username/disableAccount', async (req, res) => {
    // Disable the account
    await TimeToMove.disableAccount(req.params.username);
    // Render the page and pass the view counts
    res.render('TimeToMove/disableAccount', { 
        session: req.session, 
        username: req.params.username
    });
});

router.post('/:username/sendDeleteConfirmation', async (req, res) => {
    const { username } = req.params;

    try {
        // Fetch the user's email from the database
        const user = await TimeToMove.getUserByUsername(username);
        if (!user) {
            return res.status(404).send('User not found');
        }

        // Call the function to generate a security code and send the confirmation email
        const securityCode = await TimeToMove.sendDeleteConfirmationEmail(user.Email, user.Username);

        // Store the security code in the user's session or database
        req.session.securityCode = securityCode;

        res.status(200).send('Confirmation email sent');
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).send('Error processing request');
    }
});

router.get('/:username/confirmDelete', async (req, res) => {
    const { username } = req.params;
    const { code } = req.query;

    try {
        // Check if the security code matches
        if (code !== req.session.securityCode) {
            return res.status(403).send('Invalid security code');
        }

        // Logic to delete the user's account
        const result = await TimeToMove.deleteUserByUsername(username);
        if (result) {
            // delete the uploads / username folder
            const userFolderPath = path.join(__dirname, '..', 'uploads', username);
            fs.rmdirSync(userFolderPath, { recursive: true });
            res.send('Your account and all its assets have been successfully deleted.');
        } else {
            res.status(400).send('Failed to delete account.');
        }
    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).send('Error deleting account.');
    }
});

router.get('/:username', async (req, res) => {
    await renderProfilePage(req, res, 'own');
});

router.get('/:username/own', async (req, res) => {
    await renderProfilePage(req, res, 'own');
});

router.get('/:username/sharedWithYou', async (req, res) => {
    await renderProfilePage(req, res, 'sharedWithYou');
});

router.get('/:username/youShared', async (req, res) => {
    await renderProfilePage(req, res, 'youShared');
});

router.post('/:username/:boxName/share', async (req, res) => {
    const { username, boxName } = req.params;
    const { shareWith, shareCode } = req.body;
    console.log("shareCode in sharebox", shareCode);

    try {
        // Find the box by name and username
        const box = await TimeToMove.findBoxByNameAndUsername(username, boxName);
        if (!box) {
            return res.status(404).send(`<script>alert('Box not found'); window.location.href='/${username}/${boxName}';</script>`);
        }

        // Check if the box is already shared with the specified user
        const isAlreadyShared = await TimeToMove.isBoxAlreadySharedWithUser(box.BoxID, shareWith);
        if (isAlreadyShared) {
            return res.status(400).send(`<script>alert('Box is already shared with ${shareWith}'); window.location.href='/${username}';</script>`);
        }

        let actualShareCode = '0';
        if (shareCode === 'on') {
            actualShareCode = box.DigitCodeIfPrivate;
        }

        // Define the actual path for the shared box
        const actualBoxPath = `/${username}/${box.TitleChosen}`;

        // Logic to share the box with the specified user and store the actual path
        await TimeToMove.shareBoxWithUser(box.BoxID, shareWith, actualShareCode, actualBoxPath);

        // Show a popup that says "Box shared"
        return res.send(`<script>alert('Box shared with ${shareWith}'); window.location.href='/${username}';</script>`);

    } catch (error) {
        console.error('Error sharing box:', error);
        res.status(500).send(`<script>alert('Error sharing box: ${error.message}'); window.location.href='/${username}';</script>`);
    }
});


// Helper function to render the profile page based on view type
async function renderProfilePage(req, res, viewType) {
    const { username } = req.params;
    const session = req.session;
    const sortOrder = req.query.sortOrder || 'recent';
    const searchQuery = req.query.search ? req.query.search.toLowerCase() : '';

    await TimeToMove.recordPageView(req, `${username}`);
    const viewCounts = await TimeToMove.getPageViewCounts(`${username}`);
    const isDisabled = await TimeToMove.isUserDisabled(username);
    let sortQuery;
    if (sortOrder === 'mostContent') {
        sortQuery = 'ORDER BY NrOfFiles DESC';
    } else {
        sortQuery = 'ORDER BY BoxID DESC';
    }

    let isAdmin = false;
    if (req.session.user) {
        isAdmin = await TimeToMove.isUserAdmin(req.session.user.username);
    }

    try {
        const user = await TimeToMove.getUserByUsername(username);

        if (!user) {
            console.log('User not found:', username);
            return res.status(404).send('User not found');
        }

        let boxes = [];
        console.log("user.ID in renderProfilePage", user.ID);
        if (viewType === 'own') {
            boxes = await TimeToMove.getUserBoxes(user.ID, sortQuery);
        } else if (viewType === 'sharedWithYou') {
            boxes = await TimeToMove.getSharedBoxes(user.ID, sortQuery);
        } else if (viewType === 'youShared') {
            boxes = await TimeToMove.getSharedBoxesByUser(user.ID, sortQuery);
        }

        // Ensure boxes is an array
        if (!Array.isArray(boxes)) {
            boxes = [];
        }

        // Filter boxes based on search query
        const filteredBoxes = boxes.filter(box => {
            const isInsuranceLabel = box.IsInsuranceLabel === 1;
            const titleChosen = box.TitleChosen.toLowerCase();
            const itemList = box.ItemList ? JSON.parse(box.ItemList) : [];

            if (isInsuranceLabel) {
                return itemList.some(item => item.toLowerCase().includes(searchQuery));
            } else {
                return titleChosen.includes(searchQuery);
            }
        });

        // Generate QR codes for public boxes and private boxes with a non-zero 6-digit code
        for (const box of filteredBoxes) {
            if (box.IsBoxPublic || (box.DigitCodeIfPrivate && box.DigitCodeIfPrivate !== '0')) {
                const boxURL = `${req.protocol}://${req.get('host')}/${username}/${box.TitleChosen}`;
                const qrCodeDataURL = await QRCode.toDataURL(boxURL, {
                    color: {
                        dark: '#000000',
                        light: '#00000000'
                    }
                });
                box.qrCodeDataURL = qrCodeDataURL;
            } else {
                box.qrCodeDataURL = null;
            }
            if (box.IsInsuranceLabel) {
                // For insurance labels, include the ItemList in the search query
                const ItemList = box.ItemList;
                const ItemListString = JSON.parse(ItemList).toString().replace(/[\[\]"]/g, '');
                boxURL = `${req.protocol}://${req.get('host')}/${username}?search=${ItemListString}`;
                const qrCodeDataURL = await QRCode.toDataURL(boxURL, {
                    color: {
                        dark: '#000000',
                        light: '#00000000'
                    }
                });
                box.qrCodeDataURL = qrCodeDataURL;
            }
        }


        const labelStylesDir = path.join(__dirname, '..', 'uploads', 'labelStyles');
        let labelStyles = [];
        if (fs.existsSync(labelStylesDir)) {
            const files = fs.readdirSync(labelStylesDir);
            labelStyles = files.map(filename => ({ filename }));
        }

        // Fetch all usernames
        const allUsernames = await TimeToMove.getAllUsernames();

        res.render('TimeToMove/profile.ejs', {
            user,
            boxes: filteredBoxes,
            labelStyles,
            isOwner: session.user && session.user.username === user.Username,
            session,
            sortOrder,
            viewCounts,
            viewType,
            isAdmin,
            allUsernames,
            isDisabled,
            searchQuery
        });
    } catch (error) {
        console.error('Error loading user profile:', error);
        res.status(500).send('Error loading profile.');
    }
}



// Route for updating the user description
router.post('/:username/editDescription', async (req, res) => {
    let { username } = req.params;
    let { UserDescription } = req.body;
    // Sanitize inputs to remove any potential HTML/JS
    UserDescription = sanitizeHtml(UserDescription);
    username = sanitizeHtml(username);

    try {
        // Ensure the logged-in user is the one trying to edit their profile
        if (req.session.user && req.session.user.username === username) {
            // Call the function in TimeToMove.js to update the description
            const result = await TimeToMove.updateUserDescription(username, UserDescription);

            if (result.success) {
                // Redirect back to the user's profile after updating the description
                return res.redirect(`/${username}`);
            } else {
                return res.render('TimeToMove/profile', {
                    user: req.session.user,
                    errorMessage: 'Error updating description',
                    session: req.session,
                    isDisabled: false
                });
            }
        } else {
            return res.status(403).send('Unauthorized to edit this profile');
        }
    } catch (error) {
        console.error('Error updating description:', error);
        return res.status(500).send('Server error');
    }
});

router.get('/:username/deleteProfilePic', async function (req, res) {
    const username = req.params.username;

    // Ensure the user is logged in and is the owner of the profile
    if (!req.session.user || req.session.user.username !== username) {
        return res.status(403).send('Unauthorized');
    }

    try {
        // Delete the profile picture file from the server
        const user = await TimeToMove.getUserByUsername(username);
        if (user && user.UserPFP) {
            const profilePicPath = path.join(__dirname, '..', 'uploads', req.params.username, user.UserPFP);
            // Delete the file if it exists
            fs.unlink(profilePicPath, (err) => {
                if (err && err.code !== 'ENOENT') {
                    console.error('Error deleting profile picture file:', err);
                }
            });

            // Update the user's profile picture path in the database
            await TimeToMove.updateUserProfilePic(username, null);
        }

        // Redirect back to the user's profile
        res.redirect('/' + username);
    } catch (error) {
        console.error('Error deleting profile picture:', error);
        res.status(500).send('Server error');
    }
});


router.post('/:username/:boxID/generate-pdf', async (req, res) => {
    const { username, boxID } = req.params;
    const { size } = req.body;

    try {
        // Get userID from username
        const userID = await TimeToMove.getUserIDFromUsername(username);
        // Fetch box details from the database
        let box = await TimeToMove.getBoxByID(userID, boxID);
        box = box[0];
        if (!box) {
            return res.status(404).send('Box not found');
        }

        // Determine the size for the PDF
        const pdfSize = Array.isArray(size) ? size : size;

        // Create a PDF document with the selected size
        const doc = new PDFDocument({ size: pdfSize });

        // Set the response headers to indicate a file download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Box-${boxID}.pdf`);

        // Pipe the PDF document to the response
        doc.pipe(res);

        // Get page dimensions
        const { width, height } = doc.page;

        // Draw a colorful rectangle that fills the entire page
        doc.rect(0, 0, width, height).fill('#f0f8ff'); // Light blue background

        // Calculate dynamic font sizes based on page size
        const titleFontSize = Math.min(20, width / 20);
        const textFontSize = Math.min(12, width / 30);

        // Check if the box is an insurance label
        if (box.IsInsuranceLabel === 1) {
            // Set text color and font for insurance label
            doc.fillColor('#000080') // Navy text color
               .fontSize(titleFontSize)
               .text(`Insurance Label: ${box.TitleChosen}`, 50, 50, { align: 'center', width: width - 100 });

            doc.moveDown();

            // Add insurance-specific details
            const itemList = JSON.parse(box.ItemList || '[]');
            const itemValues = JSON.parse(box.ItemValues || '[]');
            const currency = box.Currency || 'USD';

            doc.fontSize(textFontSize)
               .text(`Item and Value:`, { align: 'center', width: width - 100 });
            itemList.forEach((item, index) => {
                const value = itemValues[index] || 'N/A';
                doc.text(`${item}: ${value} ${currency}`, { align: 'center', width: width - 100 });
            });

            // Add company logo
            // CompanyLogoPath is just the filename, so we need to construct the full path
            if (box.CompanyLogoPath) {
                const logoPath = path.join(__dirname, '..', 'uploads', 'companyLogos', box.CompanyLogoPath);
                const logoSize = Math.min(100, width / 4);
                const logoX = (width - logoSize) / 2;
                const logoY = doc.y + 20; // 20px margin from the last text
                doc.image(logoPath, logoX, logoY, { fit: [logoSize, logoSize] });
            }

        } else {
            // Set text color and font for regular box
            doc.fillColor('#000080') // Navy text color
               .fontSize(titleFontSize)
               .text(`Box Title: ${box.TitleChosen}`, 50, 50, { align: 'center', width: width - 100 });

            doc.moveDown()
               .fontSize(textFontSize)
               .text(`Description: ${box.Description || 'No description available'}`, { align: 'center', width: width - 100 });

            doc.text(`Public: ${box.IsPublic ? 'Yes' : 'No'}`, { align: 'center', width: width - 100 });
            doc.text(`Number of Files: ${box.NumberOfFiles || 0}`, { align: 'center', width: width - 100 });
        }

        doc.moveDown();

        // Generate QR Code
        const qrCodeData = `https://felixcenusa.com/${username}/${boxID}`;
        QRCode.toDataURL(qrCodeData, { errorCorrectionLevel: 'H' }, (err, url) => {
            if (err) {
                console.error('Error generating QR code:', err);
            } else {
                // Calculate QR code size and position
                const qrImageSize = Math.min(100, width / 4);
                const qrX = (width - qrImageSize) / 2;
                const qrY = height - qrImageSize - 50; // 50px margin from bottom
                doc.image(url, qrX, qrY, { fit: [qrImageSize, qrImageSize] });
            }
            doc.end();
        });

    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).send('Error generating PDF');
    }
});



// Route to update box name, description, and public/private status
router.post('/:username/:boxID/editBox', async (req, res) => {
    let { username, boxID } = req.params;
    let { newBoxName, newBoxDescription, isBoxPublic, withDigitCode } = req.body;

    // Sanitize inputs to remove any potential HTML/JS
    username = sanitizeHtml(username);
    boxID = sanitizeHtml(boxID);
    newBoxName = sanitizeHtml(newBoxName);
    newBoxDescription = sanitizeHtml(newBoxDescription);
    withDigitCode = sanitizeHtml(withDigitCode); // Sanitize the digit code

    // Convert isBoxPublic to a boolean
    isBoxPublic = (isBoxPublic === 'true');

    try {
        // Ensure the user is logged in and is the owner of the box
        if (req.session.user && req.session.user.username === username) {
            // Call the function to update the box with the public/private status and digit code
            await TimeToMove.updateBox(boxID, newBoxName, newBoxDescription, isBoxPublic, withDigitCode);

            // Redirect back to the profile page
            res.redirect('/' + username);
        } else {
            res.status(403).send('Unauthorized to edit this box.');
        }
    } catch (error) {
        console.error('Error updating box:', error);
        res.status(500).send('Server error while updating box.');
    }
});

// Route to update insurance label details
router.post('/:username/:boxID/editInsuranceLabel', async (req, res) => {
    let { username, boxID } = req.params;
    let { insuranceTitle, itemList, itemValues, currency } = req.body;

    // Sanitize inputs to remove any potential HTML/JS
    username = sanitizeHtml(username);
    boxID = sanitizeHtml(boxID);
    insuranceTitle = sanitizeHtml(insuranceTitle);
    itemList = sanitizeHtml(itemList);
    itemValues = sanitizeHtml(itemValues);
    currency = sanitizeHtml(currency);

    try {
        // Ensure the user is logged in and is the owner of the box
        if (req.session.user && req.session.user.username === username) {
            // Convert itemList and itemValues from strings to arrays
            const itemListArray = itemList.split('\n').map(item => item.trim()).filter(item => item);
            const itemValuesArray = itemValues.split('\n').map(value => value.trim()).filter(value => value);

            // Call the function to update the insurance label with the new details
            await TimeToMove.updateInsuranceLabel(boxID, insuranceTitle, itemListArray, itemValuesArray, currency);

            // Redirect back to the profile page
            res.redirect('/' + username);
        } else {
            res.status(403).send('Unauthorized to edit this insurance label.');
        }
    } catch (error) {
        console.error('Error updating insurance label:', error);
        res.status(500).send('Server error while updating insurance label.');
    }
});




// Helper function to use fs.readFile with Promises
function readFilePromise(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                return reject(err);
            }
            resolve(data);
        });
    });
}

router.get('/:username/:boxName', async (req, res) => {
    const { username, boxName } = req.params;
    //console.log("username:", username);
    //console.log("boxName:", boxName);
    //console.log("Session user:", req.session.user);

    await TimeToMove.recordPageView(req, `${username}${boxName}`);
    // Retrieve the view counts
    const viewCounts = await TimeToMove.getPageViewCounts(`${username}${boxName}`);
    // Render the page and pass the view counts
    // async         viewCounts
    // if boxName is a number, it's a boxID
    // if boxName is a string, it's a boxName
    // Check if boxName is a number (indicating it's a boxID)
let boxID;
if (!isNaN(boxName)) {
    // boxName is a number, treat it as a boxID
    console.log("boxName is a number (boxID)");
    //boxID = await TimeToMove.getBoxByID(boxName);  // Fetch the box by boxID
    boxID = boxName;
} else {
    // boxName is a string, treat it as a boxName
    //console.log("boxName is a string (boxName)");
    boxID = await TimeToMove.getBoxID(username, boxName);  // Fetch the box by boxName
    boxID = boxID[0].BoxID;
}
    //console.log('boxID in usrname "boxname" upload:', boxID);
    if (!boxID) {
        return res.render('TimeToMove/boxContents', {
            errorMessage: 'Box not found',
            user,
            box: null, 
            contents: [],
            session: req.session
        });
    }
    //console.log("BOX ID HEREEEE", boxID);

    try {
        //console.log("Sanity check")
        const user = await TimeToMove.getUserByUsername(username);
        //console.log("Lets log if the session user is the owner of the box", req.params.username, " AGAIN ",user.Username);
        //console.log("STRAIGHT UPPP", user, " AGAIN ",username);

        if (!user) {
            return res.status(404).send('User not found');
        }
        //console.log("boxID", boxID);
        //console.log("user.ID", user.ID);
        const box = await TimeToMove.getBoxByID(user.ID, boxID);
        //console.log("boxUSER BOX NAME", box);
        if (!box) {
            return res.status(404).send('Box not found');
        }

        const isOwner = req.params.username === user.Username;
        const isVerified = req.session.verifiedBoxes && req.session.verifiedBoxes[boxID];

        // Check if the box is public, the user is the owner, or the box has been verified
        if (box[0].IsBoxPublic || isOwner || isVerified) {
            const boxContents = await TimeToMove.getBoxContents(boxID);
            const totalSize = boxContents.reduce((acc, content) => acc + content.MediaSize, 0);

        await Promise.all(boxContents.map(async content => {
            if (content.MediaType === 'txt') {
                const filePath = path.join(__dirname, '..', 'uploads', content.MediaPath);
                try {
                    content.textContent = await readFilePromise(filePath);
                } catch (err) {
                    console.error(`Error reading file at ${filePath}:`, err);
                    content.textContent = 'Error reading text file.';
                }
                content.fileName = path.basename(content.MediaPath);
            }
        }));

            res.render('TimeToMove/boxContents.ejs', {
                errorMessage: "",
                user,
                box,
                contents: boxContents,
                isOwner,
                totalSize,
                session: req.session,
                viewCounts
            });
        } else {
            res.render('TimeToMove/boxContents.ejs', {
                errorMessage: 'Access denied, box is private.',
                user,
                box: null,
                contents: [],
                session: req.session
            });
        }
    } catch (error) {
        console.error('Error loading box contents:', error);
        res.status(500).send('Error loading box contents.');
    }
});













// Set up multer for file uploads
// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        //console.log("req.params.boxID", req.params.boxID);
        //console.log("req.params.box", req.params.box);
        //console.log("req.params", req.params);
        //console.log("req.params.Username", req.params.username);
        //console.log("req.params.boxName", req.params.boxName);
        //works
        console.log("This Shi fr works multer Disk storage");

        const uploadPath = path.join(__dirname, '..', 'uploads', req.params.username, req.params.boxName);
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
},
    filename: function (req, file, cb) {
        cb(null, file.originalname); // Save with original filename
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // Optional: Limit file size to 10MB
});

// POST route for handling file uploads
router.post('/:username/:boxName/upload', upload.fields([
    { name: 'imageFile', maxCount: 1 },
    { name: 'textFile', maxCount: 1 },
    { name: 'audioFile', maxCount: 1 },
    { name: 'videoFile', maxCount: 1 }  // New field for video file upload
]), async (req, res) => {
    const { username, boxName } = req.params;
    let gotThisFar = 0;
    console.log("gotThisFar", gotThisFar++);
    try {
        // Fetch the user and boxID
        const user = await TimeToMove.getUserByUsername(username);
        if (!user) {
            return res.render('TimeToMove/boxContents', {
                errorMessage: 'User not found',
                user: req.session.user,
                box: null, 
                contents: [],
                session: req.session
            });
        }
        const boxID = boxName;
        console.log('boxID IN UPLOAD', boxID);
       
        console.log("gotThisFar", gotThisFar++);

     

        // Handle different file types
        let file;
        if (req.files.imageFile) {
            file = req.files.imageFile[0];
        } else if (req.files.textFile) {
            file = req.files.textFile[0];
        } else if (req.files.audioFile) {
            file = req.files.audioFile[0];
        } else if (req.files.videoFile) {  // Handle video files
            file = req.files.videoFile[0];
         }
        console.log("gotThisFar", gotThisFar++);
        
        
        // Construct media path using boxID instead of boxName
        const mediaPath = path.join(username, boxID.toString(), file.originalname);
        console.log("gotThisFar", gotThisFar++);
        // Ensure the folder exists using boxID
        const uploadDir = path.join(__dirname, '..', 'uploads', username, boxID.toString());
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        console.log("gotThisFar", gotThisFar++);

        // Move the file to the correct directory (using boxID) 
        const filePath = path.join(uploadDir, file.originalname);
        fs.renameSync(file.path, filePath);
        console.log("gotThisFar", gotThisFar++);

        // Insert the media into the database
        await TimeToMove.insertMediaIntoBox(boxID.toString(), mediaPath, path.extname(file.originalname).slice(1));
        console.log("gotThisFar", gotThisFar++); 

        // Redirect back to the box page after upload
        res.redirect(`/${username}/${boxName}`);
    } catch (err) {
        console.error('Error during file upload:', err);
        return res.render('TimeToMove/boxContents', {
            errorMessage: 'Error uploading file',
            user: req.session.user,
            box: null,
            contents: [],
            session: req.session
        });
    }
});








router.get('/:username/:boxID/downloadAll', async (req, res) => {
    const { username, boxID } = req.params;
    try {
        
        // Fetch the user and box
        const user = await TimeToMove.getUserByUsername(username);
        console.log('UserAAAAAAAAAAAAAAAAAAAAAA:', user);
        console.log("req.session", req.session)
        if (!user) {
            return res.render('TimeToMove/boxContents', {
                errorMessage: 'User not found',
                user: req.session.user,
                box: null, 
                contents: [],
                session: req.session
            });
        }
        console.log('boxID IN DOWNLOADALL:', boxID);
        console.log('user.ID IN DOWNLOADALL:', user.ID);
        const box = await TimeToMove.getBoxByID(user.ID, boxID);
        console.log('boxxxxxxxxxxxxxxxxxxxxxx:', box);

        if (!box) {
            return res.render('TimeToMove/boxContents', {
                errorMessage: 'Box not found',
                user,
                box: null, // Pass null when box is not found
                contents: [],
                session: req.session
            });
        }

        // Fetch the files associated with the box
        // console.log("box.BoxID", box.BoxID);
        // console.log("box", box);
        // console.log("box.000BoxID", box[0].BoxID);
        const boxContents = await TimeToMove.getBoxContents(boxID);
        console.log('boxContentsHEREEEESADASD:', boxContents);
        if (!boxContents || boxContents.length === 0) {
            return res.render('TimeToMove/boxContents', {
                errorMessage: 'No files found in the box',
                user,
                box: null, 
                contents: [],
                session: req.session
            });
        }
        // get TitleChosen for the zip file
        console.log("THIS IS GONAN FUCK UP FOR USRE")
        const boxName = box[0].TitleChosen;
        console.log("BOX NAME HERE DOWNLOAD ALL", boxName)
        // Set up ZIP archive response
        res.setHeader('Content-Disposition', `attachment; filename=${username}_${boxName}.zip`);
        const archive = archiver('zip', {
            zlib: { level: 9 } // Sets the compression level
        });
        console.log("got this far123")
        
        archive.pipe(res);
        console.log("got this far123")

        // Append files from the database to the ZIP archive
        for (const content of boxContents) {
            const filePath = path.join(__dirname, '..', 'uploads', content.MediaPath);

            // Check if the file exists before appending
            if (fs.existsSync(filePath)) {
                archive.file(filePath, { name: path.basename(filePath) });
            } else {
                console.error(`File not found: ${filePath}`);
            }
        }
        console.log("got this far123")

        // Finalize the ZIP file
        await archive.finalize();
    } catch (err) {
        console.error('Error creating ZIP for box:', err);
        return res.render('TimeToMove/boxContents', {
            errorMessage: 'Error creating ZIP file',
            user: req.session.user,
            box: null, 
            contents: [],
            session: req.session
        });
    }
});

router.post('/:username/:boxID/rename', async (req, res) => {
    let { username, boxID } = req.params;
    let { newBoxName, oldBoxName } = req.body; // Ensure oldBoxName is passed
    // Sanitize inputs to remove any potential HTML/JS
    username = sanitizeHtml(username);	
    boxID = sanitizeHtml(boxID);
    newBoxName = sanitizeHtml(newBoxName);
    oldBoxName = sanitizeHtml(oldBoxName);
    try {
        if (req.session.user && req.session.user.username === username) {
            const result = await TimeToMove.renameBox(boxID, newBoxName, oldBoxName, username);

            if (result.success) {
                res.redirect(`/${username}`);
            } else {
                res.status(400).send(result.message);
            }
        } else {
            res.status(403).send('You do not have permission to rename this box.');
        }
    } catch (err) {
        console.error('Error processing box rename:', err);
        res.status(500).send('Error renaming the box.');
    }
});

router.post('/:username/:boxID/delete', async (req, res) => {
    let { username, boxID } = req.params;
    // Sanitize inputs to remove any potential HTML/JS
    username = sanitizeHtml(username);
    boxID = sanitizeHtml(boxID);

    try {
        // Fetch the user
        const user = await TimeToMove.getUserByUsername(username);

        if (!user) {
            return res.status(404).send('User not found');
        }

        // Fetch the box and ensure it belongs to the user
        const box = await TimeToMove.getBoxByIDONLY(boxID);
        console.log('DELEsssTE ROUTE box:', box);
        if (!box || box.UserID !== user.ID) {
            return res.status(404).send('Box not found or unauthorized');
        }

        // Delete the media files from the file system and the database
        await TimeToMove.deleteBoxWithContents(boxID);

        // Redirect to the profile page after deletion
        res.redirect(`/${username}`);
    } catch (err) {
        console.error('Error deleting box:', err);
        res.status(500).send('Error deleting box');
    }
});

router.post('/:username/:boxID/verifyCode', async (req, res) => {
    const { username, boxID } = req.params;
    const { inputCode } = req.body;

    try {
        const user = await TimeToMove.getUserByUsername(username);
        if (!user) {
            return res.status(404).send('User not found');
        }

        const box = await TimeToMove.getBoxByID(user.ID, boxID);
        if (!box) {
            return res.status(404).send('Box not found');
        }

        const isOwner = req.session.user && req.session.user.username === user.Username;

        // Debug: Log the codes being compared
        console.log('Input Code:', inputCode);
        console.log('Stored Code:', box[0].DigitCodeIfPrivate);

        // Ensure both codes are strings for comparison
        if (String(box[0].DigitCodeIfPrivate) === String(inputCode) || isOwner) {
            // Store a flag in the session to indicate successful verification
            req.session.verifiedBoxes = req.session.verifiedBoxes || {};
            req.session.verifiedBoxes[boxID] = true;

            // Redirect to the box contents page
            return res.redirect(`/${username}/${boxID}`);
        } else {
            res.render('TimeToMove/boxContents.ejs', {
                errorMessage: 'Incorrect code. Access denied.',
                user,
                box: null,
                contents: [],
                session: req.session
            });
        }
    } catch (error) {
        console.error('Error verifying code:', error);
        res.status(500).send('Error verifying code.');
    }
});



router.post('/:username/:boxName/:mediaID/delete', async (req, res) => {
    let { username, boxName, mediaID } = req.params;
    // Sanitize inputs to remove any potential HTML/JS
    username = sanitizeHtml(username);
    boxName = sanitizeHtml(boxName);
    mediaID = sanitizeHtml(mediaID);

    try {
        // Check if the logged-in user is the owner of the box
        if (req.session.user && req.session.user.username === username) {
            // Delete the file from the database and the file system
            await TimeToMove.deleteMedia(mediaID);
            res.redirect(`/${username}/${boxName}`);
        } else {
            res.status(403).send('Access Denied');
        }
    } catch (err) {
        console.error('Error deleting file:', err);
        res.status(500).send('Error deleting file.');
    }
});


// Configure multer for profile picture uploads
const profilePicStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '..', 'uploads', req.params.username);
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const username = req.params.username;
        const ext = path.extname(file.originalname);
        let fileOriginalName = file.originalname;
        // delete the file extension from the original name including malicious code
        fileOriginalName = fileOriginalName.replace(ext, '');
        const filename = username + '_' + fileOriginalName + ext;
        cb(null, filename);
    }
});

const uploadProfilePic = multer({
    storage: profilePicStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPG, PNG, and GIF are allowed.'));
        }
    }
}).single('profilePic');

// Route to handle profile picture upload
// Route to handle profile picture upload
router.post('/:username/uploadProfilePic', function (req, res) {
    const username = sanitizeHtml(req.params.username); // Sanitize inputs to remove any potential HTML/JS

    // Ensure the user is logged in and is the owner of the profile
    if (!req.session.user || req.session.user.username !== username) {
        return res.status(403).send('Unauthorized');
    }

    // Find the existing profile picture file path in the database
    TimeToMove.getUserProfilePic(username) // Assuming this function retrieves the user's current profile picture filename from the database
        .then((oldProfilePic) => {
            uploadProfilePic(req, res, async function (err) {
                if (err) {
                    console.error('Error uploading profile picture:', err);
                    return res.status(400).send(err.message);
                }

                // Delete the old profile picture if it exists
                if (oldProfilePic && oldProfilePic !== 'default-picture.png') { // Ensure you don't delete a default picture
                    const oldProfilePicPath = path.join(__dirname, '..', 'uploads', username, oldProfilePic);

                    fs.access(oldProfilePicPath, fs.constants.F_OK, (err) => {
                        if (!err) {
                            fs.unlink(oldProfilePicPath, (err) => {
                                if (err) {
                                    console.error('Error deleting old profile picture:', err);
                                } else {
                                    console.log('Old profile picture deleted:', oldProfilePic);
                                }
                            });
                        }
                    });
                }

                // Update the user's profile picture path in the database
                try {
                    // Get the new file name
                    const filename = req.file.filename;
                    console.log("filename FROM PFP", filename);

                    await TimeToMove.updateUserProfilePic(username, filename); // Update the new profile pic in the database

                    // Redirect back to the user's profile
                    res.redirect('/' + username);
                } catch (error) {
                    console.error('Error updating profile picture in database:', error);
                    res.status(500).send('Server error');
                }
            });
        })
        .catch((error) => {
            console.error('Error retrieving old profile picture from database:', error);
            res.status(500).send('Server error');
        });
});













module.exports = router;