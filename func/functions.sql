DROP TABLE IF EXISTS exam;
CREATE TABLE exam
(
    `acronym` CHAR(4) PRIMARY KEY,
    `score` INTEGER
);

INSERT INTO exam
VALUES
    ('adam', 77),
    ('ubbe', 52),
    ('june', 49),
    ('john', 63),
    ('meta', 97),
    ('siva', 88);

SELECT * FROM exam;

--
-- Function for grading an exam.
--
DROP FUNCTION IF EXISTS grade;
DELIMITER ;;

CREATE FUNCTION grade(
    score INTEGER
)
RETURNS INTEGER
DETERMINISTIC
BEGIN
    RETURN score;
END
;;

DELIMITER ;