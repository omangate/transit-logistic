CREATE ROLE transit LOGIN PASSWORD 'transit_secret';
CREATE DATABASE transit_logistic OWNER transit;
GRANT ALL PRIVILEGES ON DATABASE transit_logistic TO transit;
