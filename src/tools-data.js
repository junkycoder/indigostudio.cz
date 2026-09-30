// Veřejné nástroje: subdoména, název a krátký popis pro HTML metadata.
export const TOOLS = [
  ["nastroje", "Online nástroje", "Praktické nástroje Indigo Studio na jednom místě."],
  ["kalkulacka", "Kalkulačka", "Rychlé výpočty přímo v prohlížeči."],
  ["procenta", "Procenta", "Vypočítejte procenta, změnu i podíl."],
  ["trojclenka", "Trojčlenka", "Přímá i nepřímá úměra bez zdržování."],
  ["dph", "DPH", "Přičtěte nebo odečtěte českou DPH."],
  ["spropitne", "Spropitné", "Rozdělte účet a spočítejte spropitné."],
  ["prevody-jednotek", "Převody jednotek", "Délka, hmotnost, objem, plocha a teplota."],
  ["prevody-men", "Převody měn", "Orientační převody podle referenčních kurzů ECB."],
  ["casova-pasma", "Časová pásma", "Zjistěte čas v různých městech světa."],
  ["velikosti-obleceni", "Velikosti oblečení", "Orientační převod běžných velikostí."],
  ["cista-mzda", "Čistá mzda", "Orientační výpočet čisté mzdy v ČR pro rok 2026."],
  ["hodinova-sazba", "Hodinová sazba", "Přepočet měsíčního cíle na hodinovou sazbu."],
  ["fakturace", "Fakturace", "Jednoduchá faktura k vytištění nebo uložení jako PDF."],
  ["uroky", "Úroky", "Výpočet jednoduchého a složeného úročení."],
  ["splatky", "Splátky", "Orientační výpočet měsíční splátky úvěru."],
  ["kalendar", "Kalendář", "Přehledný měsíční kalendář."],
  ["datum", "Datum", "Rozdíl mezi daty a posun o dny."],
  ["pracovni-dny", "Pracovní dny", "Počet pracovních dnů mezi dvěma daty."],
  ["odpocet", "Odpočet", "Odpočet do vybraného dne a času."],
  ["stopky", "Stopky", "Jednoduché stopky s mezičasy."],
  ["casovac", "Časovač", "Odpočet nastaveného času s upozorněním."],
  ["pocitadlo-slov", "Počítadlo slov", "Počet slov, znaků, vět a odhad čtení."],
  ["formatovani-textu", "Formátování textu", "Úprava velikosti písmen, mezer a řádků."],
  ["qr-kod", "QR kód", "Vytvořte QR kód pro odkaz nebo krátký text."],
  ["generator-hesel", "Generátor hesel", "Bezpečná hesla vytvořená ve vašem zařízení."],
  ["barvy", "Barvy", "Barvy, odstíny a kódy HEX, RGB a HSL."],
  ["kontrast", "Kontrast", "Porovnejte čitelnost dvou barev podle WCAG."],
  ["rozmery-obrazku", "Rozměry obrázku", "Zjistěte rozměry a poměr stran obrázku."],
  ["komprese-obrazku", "Komprese obrázku", "Zmenšete obrázek v prohlížeči."],
  ["metadata", "Metadata souboru", "Základní údaje a metadata vybraného souboru."],
  ["exif", "EXIF fotografií", "Přečtěte a upravte údaje EXIF ve fotografii přímo v prohlížeči."],
  ["upravy-obrazku", "Úpravy obrázku", "Otočte, ořízněte, zmenšete nebo převeďte obrázek v prohlížeči."],
  ["prevod-formatu", "Převod formátů", "Převod dat mezi JSON, YAML, CSV, XML a dalšími formáty."],
  ["prohlizec", "Prohlížeč a zařízení", "Co o vašem zařízení ví prohlížeč a které funkce podporuje."],
  ["bluetooth", "Bluetooth", "Vyhledejte zařízení Bluetooth LE a přečtěte jejich údaje."],
];

export const TOOL_BY_HOST = new Map(TOOLS.map(([slug, title, description]) => [
  `${slug}.indigostudio.cz`, { slug, title, description },
]));

// Pořadí a skupiny katalogu pro serverové vykreslení.
export const TOOL_CATALOG = [
  ["Rozcestníky", ["ceska-republika"]],
  ["Výpočty", ["kalkulacka", "procenta", "trojclenka", "dph", "spropitne"]],
  ["Převody", ["prevody-jednotek", "prevody-men", "casova-pasma", "velikosti-obleceni"]],
  ["Práce a finance", ["cista-mzda", "hodinova-sazba", "fakturace", "uroky", "splatky"]],
  ["Čas a plánování", ["kalendar", "datum", "pracovni-dny", "odpocet", "stopky", "casovac"]],
  ["Text a obsah", ["pocitadlo-slov", "formatovani-textu", "qr-kod", "generator-hesel"]],
  ["Web a soubory", ["barvy", "kontrast", "upravy-obrazku", "rozmery-obrazku", "komprese-obrazku", "exif", "metadata"]],
  ["Vývoj a zařízení", ["prevod-formatu", "prohlizec", "bluetooth"]],
];
