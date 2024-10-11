// Should have done this from the beginning, but I'm going to refactor the email service into its own file for future email sending purposes.
const nodemailer = require('nodemailer');

// Create the Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',  // You can replace this with another email service like SendGrid, etc.
    auth: {
        user: process.env.EMAIL_USER,  // Use the email from the .env file
        pass: process.env.EMAIL_PASS   // Use the password from the .env file
    }
});

// Reusable function to send an email
async function sendEmail(to, subject, text) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,  // Sender email
            to,                            // Recipient email
            subject,                       // Email subject
            text                           // Email body
        };

        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${to}`);
        return true;
    } catch (error) {
        console.error(`Failed to send email to ${to}:`, error);
        return false;
    }
}

module.exports = { sendEmail };
