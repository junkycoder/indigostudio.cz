-- Otazník: „nevím jistě, co to je a k čemu". Vlastní osa vedle rozsahu a nice —
-- ty odpovídají na „chceme to", tohle na „rozumím tomu vůbec".
ALTER TABLE sb_ratings ADD COLUMN unsure INTEGER;

ALTER TABLE sb_history ADD COLUMN unsure_from INTEGER;
ALTER TABLE sb_history ADD COLUMN unsure_to INTEGER;
