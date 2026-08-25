-- „Nice to have" jako vlastní osa vedle rozsahu: nad rámec zadání říká, ODKUD
-- to je, tohle říká, jestli to vůbec potřebujeme.
ALTER TABLE sb_ratings ADD COLUMN nice INTEGER;

ALTER TABLE sb_history ADD COLUMN nice_from INTEGER;
ALTER TABLE sb_history ADD COLUMN nice_to INTEGER;
