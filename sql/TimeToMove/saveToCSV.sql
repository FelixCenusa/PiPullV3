-- Script to export the data from each table into CSV files inside the /csv directory

-- Set up the directory where CSV files will be stored
-- SET 'C:/Users/felix/Desktop/AgainProjectFelix/sql/TimeToMove/csv/' = 'C:/Users/felix/Desktop/AgainProjectFelix/sql/TimeToMove/csv/';

-- Export TempUsers table
SELECT * INTO OUTFILE 'C:/Users/felix/Desktop/AgainProjectFelix/sql/TimeToMove/csv/tempusers.csv'
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"' 
LINES TERMINATED BY '\n'
FROM TempUsers;

-- Export Users table
SELECT * INTO OUTFILE 'C:/Users/felix/Desktop/AgainProjectFelix/sql/TimeToMove/csv/users.csv'
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"' 
LINES TERMINATED BY '\n'
FROM Users;

-- Export Boxes table
SELECT * INTO OUTFILE 'C:/Users/felix/Desktop/AgainProjectFelix/sql/TimeToMove/csv/boxes.csv'
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"' 
LINES TERMINATED BY '\n'
FROM Boxes;

-- Export BoxMedia table
SELECT * INTO OUTFILE 'C:/Users/felix/Desktop/AgainProjectFelix/sql/TimeToMove/csv/boxmedia.csv'
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"' 
LINES TERMINATED BY '\n'
FROM BoxMedia;

-- Export Visited table
SELECT * INTO OUTFILE 'C:/Users/felix/Desktop/AgainProjectFelix/sql/TimeToMove/csv/visited.csv'
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"' 
LINES TERMINATED BY '\n'
FROM Visited;

-- Export Likes table
SELECT * INTO OUTFILE 'C:/Users/felix/Desktop/AgainProjectFelix/sql/TimeToMove/csv/likes.csv'
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"' 
LINES TERMINATED BY '\n'
FROM Likes;
