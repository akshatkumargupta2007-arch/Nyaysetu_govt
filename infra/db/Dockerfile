# Gov database: the open-source Tiger Data / TimescaleDB engine (PostgreSQL 17) with PostGIS, pgvector,
# pgvectorscale, pg_textsearch (BM25), h3 and the TimescaleDB toolkit already installed.
#
# Why this image and not `FROM postgis/postgis`: that image has no arm64 build (it fails on Apple Silicon) and
# has no time-series engine. This one is multi-architecture and is the same engine family as Tiger Cloud, so the
# SQL we run locally is the SQL we run on Tiger Cloud (the cloud's exact versions are checked after signup).
FROM timescale/timescaledb-ha:pg17
COPY init.sql /docker-entrypoint-initdb.d/00-extensions.sql
