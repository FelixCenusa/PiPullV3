This text file will get pulled with the latest update and contains what code
needs to be run manually and directly on the raspberry pi for the server to work.
    Delete the following when they have been completed:



    TERMINAL CODE RUN:
npm install passport passport-google-oauth20 dotenv


    MARIADB RUN:
    sudo mariadb -u root -p  (use mariaDB password after)
ALTER TABLE Users ADD GoogleID VARCHAR(255);