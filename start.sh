#!/bin/bash

dbhost=$1
dbport=$2
dbusername=$3

appport=$4
jwtexp=$5

touch .env
echo "APP_PORT=$4 DB_PORT=$2 DB_HOST=$1 DB_USERNAME=$3 JWT_EXPIRY=$5" | sudo tee -a .env

echo "Starting express application"
echo "Port: $4"
echo "DB: $1:$2@$3"

node src/API/Index.ts