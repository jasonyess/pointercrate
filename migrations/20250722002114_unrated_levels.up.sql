ALTER TABLE demons ADD COLUMN rated BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE players ADD COLUMN unrated_score DOUBLE PRECISION NOT NULL DEFAULT 0.0;
ALTER TABLE nationalities ADD COLUMN unrated_score DOUBLE PRECISION NOT NULL DEFAULT 0.0;
ALTER TABLE subdivisions ADD COLUMN unrated_score DOUBLE PRECISION NOT NULL DEFAULT 0.0;

-- stats viewer stuff
DROP VIEW score_giving;

CREATE VIEW score_giving AS
    SELECT records.progress, demons.position, demons.requirement, records.player, demons.rated
    FROM records
    INNER JOIN demons
    ON demons.id = records.demon
    WHERE records.status_ = 'APPROVED' AND (demons.position <= 75 OR records.progress = 100)

    UNION

    SELECT 100, demons.position, demons.requirement, demons.verifier, demons.rated
    FROM demons;

CREATE OR REPLACE FUNCTION recompute_player_scores() RETURNS void AS $$
    UPDATE players
    SET score = COALESCE(q.score, 0), unrated_score = COALESCE(q.unrated_score, 0)
    FROM (
        SELECT player, 
        SUM(record_score(progress, position, 150, requirement)) as unrated_score,
        SUM(record_score(progress, position, 150, requirement))
            FILTER (WHERE rated) AS score
        FROM score_giving
        GROUP BY player
    ) q
    WHERE q.player = id;
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION score_of_nation(is_rated BOOLEAN, iso_country_code VARCHAR(2)) RETURNS DOUBLE PRECISION AS $$
    SELECT SUM(record_score(q.progress, q.position, 150, q.requirement))
    FROM (
        SELECT DISTINCT ON (position) * from score_giving
        INNER JOIN players 
                ON players.id=player
        WHERE players.nationality = iso_country_code AND rated = is_rated
        ORDER BY position, progress DESC
    ) q
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION recompute_nation_scores() RETURNS void AS $$
    UPDATE nationalities
    SET score = COALESCE(p.score, 0), unrated_score = COALESCE(p.unrated_score, 0)
    FROM (
        SELECT nationality,
        SUM(record_score(q.progress, q.position, 150, q.requirement)) AS score,
        SUM(record_score(q.progress, q.position, 150, q.requirement))
            FILTER (WHERE q.rated) AS unrated_score
        FROM (
            SELECT DISTINCT ON (position, nationality) * from score_giving
            INNER JOIN players 
                    ON players.id = player
            WHERE players.nationality IS NOT NULL
            ORDER BY players.nationality, position, progress DESC
        ) q
        GROUP BY nationality
    ) p
    WHERE p.nationality = iso_country_code
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION score_of_subdivision(is_rated BOOLEAN, iso_country_code VARCHAR(2), iso_code VARCHAR(3)) RETURNS DOUBLE PRECISION AS $$
    SELECT SUM(record_score(q.progress, q.position, 150, q.requirement))
    FROM (
        SELECT DISTINCT ON (position) * from score_giving
        INNER JOIN players 
                ON players.id=player
        WHERE players.nationality = iso_country_code
          AND players.subdivision = iso_code
          AND rated = is_rated
        ORDER BY position, progress DESC
    ) q
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION recompute_subdivision_scores() RETURNS void AS $$
    UPDATE subdivisions
    SET score = COALESCE(p.score, 0), unrated_score = COALESCE(p.unrated_score, 0)
    FROM (
        SELECT nationality, subdivision,
            SUM(record_score(q.progress, q.position, 150, q.requirement)) AS score,
            SUM(record_score(q.progress, q.position, 150, q.requirement))
                FILTER (WHERE q.rated) AS unrated_score
        FROM (
            SELECT DISTINCT ON (position, nationality, subdivision) * from score_giving
            INNER JOIN players 
                    ON players.id=player
            WHERE players.nationality IS NOT NULL
              AND players.subdivision IS NOT NULL
            ORDER BY players.nationality, players.subdivision, position, progress DESC
        ) q
        GROUP BY nationality, subdivision
    ) p
    WHERE p.nationality = nation
      AND p.subdivision = iso_code
$$ LANGUAGE SQL;

SELECT recompute_player_scores();
SELECT recompute_nation_scores();
SELECT recompute_subdivision_scores();

DROP VIEW ranked_players;
DROP MATERIALIZED VIEW player_ranks;

CREATE MATERIALIZED VIEW player_ranks AS
    SELECT
        RANK() OVER (ORDER BY score DESC) as rank,
        RANK() OVER (ORDER BY unrated_score) as unrated_rank,
        id
    FROM players
    WHERE
        score != 0 AND NOT banned;

CREATE UNIQUE INDEX player_ranks_id_idx ON player_ranks(id);

CREATE VIEW ranked_players AS
SELECT
    ROW_NUMBER() OVER(ORDER BY rank, id) AS index,
    ROW_NUMBER() OVER (ORDER BY unrated_rank, id) AS unrated_index,
    rank,
    unrated_rank,
    id, name, players.score, players.unrated_score,
    subdivision,
    nationalities.iso_country_code,
    nationalities.nation,
    nationalities.continent
FROM players
LEFT OUTER JOIN nationalities
    ON players.nationality = nationalities.iso_country_code
NATURAL JOIN player_ranks;

DROP VIEW ranked_nations;

CREATE VIEW ranked_nations AS 
    SELECT 
        ROW_NUMBER() OVER (ORDER BY score DESC, iso_country_code) AS index,
        ROW_NUMBER() OVER (ORDER BY unrated_score DESC, iso_country_code) AS unrated_index,
        RANK() OVER (ORDER BY score DESC) AS rank,
        RANK() OVER (ORDER BY unrated_score DESC) AS unrated_rank,
        score,
        iso_country_code,
        nation,
        continent
    FROM nationalities
    WHERE score > 0.0;

-- audit log stuff
ALTER TABLE demon_modifications ADD COLUMN rated BOOLEAN NULL DEFAULT NULL;

CREATE OR REPLACE FUNCTION audit_demon_modification() RETURNS trigger AS $demon_modification_trigger$
DECLARE
    name_change CITEXT;
    position_change SMALLINT;
    requirement_change SMALLINT;
    video_change VARCHAR(200);
    thumbnail_change TEXT;
    verifier_change INT;
    publisher_change INT;
    rated_change BOOLEAN;
BEGIN
    IF (OLD.name <> NEW.name) THEN
        name_change = OLD.name;
    END IF;

    IF (OLD.position <> NEW.position) THEN
        position_change = OLD.position;
    END IF;

    IF (OLD.requirement <> NEW.requirement) THEN
        requirement_change = OLD.requirement;
    END IF;

    IF (OLD.video <> NEW.video) THEN
        video_change = OLD.video;
    END IF;

    IF (OLD.thumbnail <> NEW.thumbnail) THEN
        thumbnail_change = OLD.thumbnail;
    END IF;

    IF (OLD.verifier <> NEW.verifier) THEN
        verifier_change = OLD.verifier;
    END IF;

    IF (OLD.publisher <> NEW.publisher) THEN
        publisher_change = OLD.publisher;
    END IF;

    IF (OLD.rated <> NEW.rated) THEN
        rated_change = OLD.rated;
    END IF;

    INSERT INTO demon_modifications (userid, name, position, requirement, video, verifier, publisher, thumbnail, rated, id)
        (SELECT id, name_change, position_change, requirement_change, video_change, verifier_change, publisher_change, thumbnail_change, rated_change, NEW.id
         FROM active_user LIMIT 1);

    RETURN NEW;
END;
$demon_modification_trigger$ LANGUAGE plpgsql;

DROP FUNCTION list_at(TIMESTAMP WITHOUT TIME ZONE);

CREATE FUNCTION list_at(TIMESTAMP WITHOUT TIME ZONE)
    RETURNS TABLE (
                      name CITEXT,
                      position_ SMALLINT,
                      requirement SMALLINT,
                      video VARCHAR(200),
                      thumbnail TEXT,
                      verifier INTEGER,
                      publisher INTEGER,
                      id INTEGER,
                      level_id BIGINT,
                      rated BOOLEAN,
                      current_position SMALLINT
                  )
AS $$
SELECT name, CASE WHEN t.position IS NULL THEN demons.position ELSE t.position END, requirement, video, thumbnail, verifier, publisher, demons.id, level_id, rated, demons.position AS current_position
FROM demons
         LEFT OUTER JOIN (
    SELECT DISTINCT ON (id) id, position
    FROM demon_modifications
    WHERE time >= $1 AND position != -1
    ORDER BY id, time
) t
                         ON demons.id = t.id
WHERE NOT EXISTS (SELECT 1 FROM demon_additions WHERE demon_additions.id = demons.id AND time >= $1)
$$
    LANGUAGE SQL
    STABLE;