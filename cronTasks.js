const cron = require('node-cron');
const TimeToMove = require('./src/TimeToMove'); 
const { sendEmail } = require('./emailService'); 

// Task runs every day at 7am to check for inactivity
cron.schedule('0 6 * * *', async () => {
    try {
        const inactiveUsers = await TimeToMove.getInactiveUsers();
        for (const user of inactiveUsers) {
            const daysInactive = user.daysInactive;

            if (daysInactive === 9000) {
                await sendEmail(user.Email, 'Your account will be deleted in 1 month', 'Log in to prevent deletion.');
            } else if (daysInactive === 12000) {
                await sendEmail(user.Email, 'Your account will be deleted in 1 week', 'Log in to prevent deletion.');
            } else if (daysInactive === 12700) {
                await sendEmail(user.Email, 'Your account will be deleted in 1 day', 'Log in to prevent deletion.');
            } else if (daysInactive === 13000) {
                await sendEmail(user.Email, 'Your account will be deleted in 2 hours', 'Log in to prevent deletion.');
            } else if (daysInactive === 13200) {
                await TimeToMove.deleteUserByID(user.ID);
                await sendEmail(user.Email, 'Your account has been deleted', 'Your account has been permanently deleted.');
            }
        }
    } catch (error) {
        console.error('Error checking inactive users:', error);
    }
});
