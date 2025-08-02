#!/bin/bash
set -e
psql -v --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE harmonicjam;
    \c harmonicjam;
    DROP DATABASE IF EXISTS mydatabase;
    DROP DATABASE IF EXISTS postgres;
EOSQL
