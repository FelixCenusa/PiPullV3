This text file will get pulled with the latest update and contains what code
needs to be run manually and directly on the raspberry pi for the server to work.
Restart pm2 manually if needed:
    spm2 stop all
    pm2 start all
Will fix automatically later, current automations are not working.
    Delete the following when they have been completed:



    TERMINAL CODE RUN:
//npm install passport passport-google-oauth20 dotenv
//npm install axios
//npm install node-cron


    MARIADB RUN:
        Delete users manually so they can register again test: 
        DELETE FROM Users WHERE username = 'your_username';
    sudo mariadb -u root -p  (use mariaDB password after)
    use TimeToMove;
 // ALTER TABLE Users ADD GoogleID VARCHAR(255);
//ALTER TABLE Users
//ADD LastLoggedIn TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE Users
ADD COLUMN isDisabled BOOLEAN DEFAULT FALSE;

ALTER TABLE BoxSharedWith
ADD ActualBoxPath VARCHAR(255) DEFAULT NULL;




    .env update with actual variables.
    cd v3TimeToMove
    nano .env
    paste code from windows
    ctrl+x , y , enter