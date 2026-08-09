# Signal Collector 0.3.1

Verze 0.3.1 přidává volbu měřených zdrojů přímo v aplikaci. Po spuštění jsou standardně vybrané všechny zdroje, ale před začátkem měření lze libovolnou položku odškrtnout nebo celý výběr vymazat a znovu zapnout.

## Novinky

- přehled všech 20 zdrojů rozdělený na senzory, GNSS/GPS, sítě a Bluetooth
- rychlé akce **Zrušit vše** a **Vše**
- tlačítko Start je dostupné, jakmile je vybraný alespoň jeden zdroj
- během měření je výběr uzamčený, aby přesně odpovídal ukládaným datům
- aplikace spouští jen vybrané kolektory a žádá jen jejich potřebná oprávnění
- experimentální aktivní scan je dostupný pouze při zapnuté mobilní síti
- dokončený TXT lze poslat přes nativní systémovou nabídku **Sdílet data**
- před novým měřením aplikace upozorní, že předchozí výsledek už poté nepůjde exportovat
- aktivní zdroje jsou označené fajfkou přímo v hlavním výběru; duplicitní spodní box byl odstraněn

## Ověření

Release APK bylo sestaveno bez chyb a ověřeno na Google Pixel 10a s Androidem 16. Test s jediným vybraným zdrojem **Akcelerometr** během 21 sekund uložil 534 záznamů a aplikace správně zobrazila právě 1 dostupný zdroj. Služba nespustila polohu, mikrofon ani Bluetooth. Nativní sdílení otevřelo systémový panel se správným TXT souborem a varování před novým měřením bylo ověřeno přímo v telefonu.

TXT formát zůstává kompatibilní s verzemi 0.2.0 a 0.3.0.

APK SHA-256: `c572421dc4aaea9cca928c379ac44d8422b40ec6e54da4a6812c9722620689aa`
