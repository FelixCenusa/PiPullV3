#!/bin/bash

# Update package list and install MariaDB server
sudo apt update
sudo apt install -y mariadb-server

# Start MariaDB service
sudo systemctl start mariadb
sudo systemctl enable mariadb

# Secure the MariaDB installation
sudo mysql_secure_installation

# Log into MariaDB as root
sudo mysql -u root <<EOF

-- Create a new database
CREATE DATABASE my_database;

-- Create a new user and grant privileges
CREATE USER '${DB_USER}'@'${DB_HOST}' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'${DB_HOST}';
FLUSH PRIVILEGES;

-- Exit MariaDB
EXIT;
EOF

echo "MariaDB setup completed. Database '${DB_NAME}' and user '${DB_USER}' created."