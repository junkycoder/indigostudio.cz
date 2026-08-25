-- Procento hotovosti na chipu stavu (25. 8. 2026). Stav (hotovo / rozdělané /
-- chybí) přestává být binární nálepka: člověk ho posouvá sliderem a label se
-- z procenta odvozuje — 100 % hotovo, 1–99 % rozdělané, 0 % chybí.
ALTER TABLE sb_ratings ADD COLUMN pct INTEGER;

ALTER TABLE sb_history ADD COLUMN pct_from INTEGER;
ALTER TABLE sb_history ADD COLUMN pct_to INTEGER;
