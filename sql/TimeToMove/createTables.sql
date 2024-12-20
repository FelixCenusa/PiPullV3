USE TimeToMove;

-- Drop the tables in the correct order to respect foreign key constraints
DROP TABLE IF EXISTS BoxMedia;
DROP TABLE IF EXISTS Likes;
DROP TABLE IF EXISTS BoxSharedWith;
DROP TABLE IF EXISTS Visited;
DROP TABLE IF EXISTS Boxes;
DROP TABLE IF EXISTS Users;
DROP TABLE IF EXISTS TempUsers;
DROP TABLE IF EXISTS PasswordResets;
DROP TABLE IF EXISTS Views;
DROP TABLE IF EXISTS Tasks;

CREATE TABLE Tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    Content VARCHAR(255) NOT NULL,
    Status VARCHAR(50) NOT NULL,
    Created_by VARCHAR(100) NOT NULL,
    Created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Moved_at TIMESTAMP,
    Moved_by VARCHAR(100)
);

CREATE TABLE TempUsers (
    TempUserID INT AUTO_INCREMENT PRIMARY KEY,
    Username VARCHAR(255) NOT NULL,
    Email VARCHAR(255) NOT NULL,
    PasswordHash VARCHAR(255) NOT NULL,
    IsPublic BOOLEAN DEFAULT FALSE,
    VerificationToken VARCHAR(64) NOT NULL,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Users (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    Username VARCHAR(255) NOT NULL,
    UserPFP VARCHAR(255), -- Path to user profile picture
    UserDescription VARCHAR(4095),-- user description
    Email VARCHAR(255) UNIQUE, -- Ensure unique emails
    PasswordHash VARCHAR(255), -- Salted and hashed password
    GoogleID VARCHAR(255), -- Google ID for OAuth
    StealthMode BOOLEAN DEFAULT FALSE, -- Stealth mode flag
    LastLoggedIn TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    isDisabled BOOLEAN DEFAULT FALSE,
    IsAdmin BOOLEAN DEFAULT FALSE -- Admin flag
);

CREATE TABLE Boxes (
    BoxID INT AUTO_INCREMENT PRIMARY KEY,
    NrOfFiles INT DEFAULT 0,
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
    ActualBoxPath VARCHAR(255),
    FOREIGN KEY (BoxID) REFERENCES Boxes(BoxID) ON DELETE CASCADE,
    FOREIGN KEY (SharedWithUserID) REFERENCES Users(ID) ON DELETE CASCADE
);


CREATE TABLE BoxMedia (
    MediaID INT AUTO_INCREMENT PRIMARY KEY,
    BoxID INT,
    MediaPath VARCHAR(255),  -- Path to Media file
    MediaType VARCHAR(10),  -- Type of media Audio, PDF, txt etc.
    MediaSize INT,  -- Size of media file in bytes
    FOREIGN KEY (BoxID) REFERENCES Boxes(BoxID)
);

CREATE TABLE Views (
    VisitedID INT AUTO_INCREMENT PRIMARY KEY,
    PageViewed VARCHAR(255) NOT NULL,
    TotalCounter INT DEFAULT 1,
    HashedUserIP VARCHAR(255) NOT NULL
);

CREATE TABLE Likes (
    LikeID INT AUTO_INCREMENT PRIMARY KEY,
    UserID INT,
    BoxID INT,
    FOREIGN KEY (UserID) REFERENCES Users(ID),
    FOREIGN KEY (BoxID) REFERENCES Boxes(BoxID)
);

CREATE TABLE PasswordResets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    Email VARCHAR(255) NOT NULL,
    Token VARCHAR(64) NOT NULL,
    ExpiresAt DATETIME NOT NULL,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
