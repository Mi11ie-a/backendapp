#!/bin/bash

dbhost=$1
dbport=$2
dbusername=$3

appport=$4
jwtexp=$5



sed -i -e "s/\(DB_HOST=\).*/\1$1/" \
-e "s/\(DB_PORT=\).*/\1$2/" \
-e "s/\(DB_USERNAME=\).*/\1$3/" \
-e "s/\(JWT_EXPIRY=\).*/\1$5/" \
-e "s/\(APP_PORT=\).*/\1$4/" \
-e "s/\(SECRET_KEY=\).*/\/" \
-e "s/\(DB_PASSWORD=\).*/\/" \

 xyz.cfg

echo "Starting express application"
echo "Port: $1"
echo "DB: $2:$3"

node src/API/Index.ts