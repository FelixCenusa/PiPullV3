This text file will get pulled with the latest update and contains what code
needs to be run manually and directly on the raspberry pi for the server to work.
    Delete the following when they have been completed:



    TERMINAL CODE RUN:
//npm install passport passport-google-oauth20 dotenv


    MARIADB RUN:
        Delete users manually so they can register again test: 
        DELETE FROM Users WHERE username = 'your_username';
    sudo mariadb -u root -p  (use mariaDB password after)
    use TimeToMove;
 // ALTER TABLE Users ADD GoogleID VARCHAR(255);


    .env update with actual variables.
    cd v3TimeToMove
    nano .env
    paste code from windows
    ctrl+x , y , enter