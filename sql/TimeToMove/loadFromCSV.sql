-- Script to import the data from CSV files located in the /csv directory into the database

-- Set up the directory where CSV files are stored
SET @input_directory = './csv/';

-- Load data into TempUsers table
LOAD DATA INFILE CONCAT(@input_directory, 'tempusers.csv')
INTO TABLE TempUsers
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"' 
LINES TERMINATED BY '\n'
IGNORE 1 LINES;  -- Ignore the first line if it's a header

-- Load data into Users table
LOAD DATA INFILE CONCAT(@input_directory, 'users.csv')
INTO TABLE Users
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"' 
LINES TERMINATED BY '\n'
IGNORE 1 LINES;

-- Load data into Boxes table
LOAD DATA INFILE CONCAT(@input_directory, 'boxes.csv')
INTO TABLE Boxes
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"' 
LINES TERMINATED BY '\n'
IGNORE 1 LINES;

-- Load data into BoxMedia table
LOAD DATA INFILE CONCAT(@input_directory, 'boxmedia.csv')
INTO TABLE BoxMedia
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"' 
LINES TERMINATED BY '\n'
IGNORE 1 LINES;

-- Load data into Visited table
LOAD DATA INFILE CONCAT(@input_directory, 'visited.csv')
INTO TABLE Visited
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"' 
LINES TERMINATED BY '\n'
IGNORE 1 LINES;

-- Load data into Likes table
LOAD DATA INFILE CONCAT(@input_directory, 'likes.csv')
INTO TABLE Likes
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"' 
LINES TERMINATED BY '\n'
IGNORE 1 LINES;
