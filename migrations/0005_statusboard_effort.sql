-- Náročnost (odhad zbývající práce v hodinách) vedle hotovosti. Výchozí číslo
-- si počítá stránka z rozpočtu bloku a zbývajících procent; jakmile ho člověk
-- posune, platí jeho.
ALTER TABLE sb_ratings ADD COLUMN effort INTEGER;

ALTER TABLE sb_history ADD COLUMN effort_from INTEGER;
ALTER TABLE sb_history ADD COLUMN effort_to INTEGER;
