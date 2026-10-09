# Gov database: PostgreSQL 17 + PostGIS. (No pgvector needed: the gov side never embeds text.)
FROM postgis/postgis:17-3.5
COPY init.sql /docker-entrypoint-initdb.d/00-extensions.sql
