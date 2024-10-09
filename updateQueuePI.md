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


    MARIADB RUN:
        Delete users manually so they can register again test: 
        DELETE FROM Users WHERE username = 'your_username';
    sudo mariadb -u root -p  (use mariaDB password after)
    use TimeToMove;
 // ALTER TABLE Users ADD GoogleID VARCHAR(255);
CREATE TABLE Boxes (
    BoxID INT AUTO_INCREMENT PRIMARY KEY,
    NrOfFiles INT,
    UserID INT,  -- Reference to the Users table
    BoxDescription VARCHAR(4095),
    IsBoxPublic BOOLEAN DEFAULT FALSE,
    LabelChosen VARCHAR(255),
    BorderImageSlice VARCHAR(50),
    BorderImageRepeat VARCHAR(50),
    TitleChosen VARCHAR(255),
    DigitCodeIfPrivate VARCHAR(6),
    FOREIGN KEY (UserID) REFERENCES Users(ID) ON DELETE CASCADE -- Ensure referential integrity
);

CREATE TABLE BoxSharedWith (
    ShareID INT AUTO_INCREMENT PRIMARY KEY,
    BoxID INT,
    SharedWithUserID INT,
    SharedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (BoxID) REFERENCES Boxes(BoxID) ON DELETE CASCADE,
    FOREIGN KEY (SharedWithUserID) REFERENCES Users(ID) ON DELETE CASCADE
);


    .env update with actual variables.
    cd v3TimeToMove
    nano .env
    paste code from windows
    ctrl+x , y , enter