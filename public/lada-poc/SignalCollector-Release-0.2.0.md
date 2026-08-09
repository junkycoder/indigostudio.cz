# Signal Collector 0.2.0

## Novinky

- pasivní deep scan všech mobilních buněk, které Android zpřístupní, zvlášť pro každou aktivní SIM/eSIM
- LTE, 5G NR, WCDMA, GSM, TD-SCDMA a CDMA s getterovými identifikátory a parametry signálu
- události změn seznamu buněk, síly signálu, service state, display info a datového spojení
- experimentální aktivní PLMN scan jako samostatný, výchozí vypnutý režim; odmítnutí systémem se uloží do TXT
- rozšířené údaje okolních Wi-Fi AP, aktuálního spojení a Wi-Fi 7 MLO
- 1Hz GPS s přesnostmi fixu a stav jednotlivých GNSS satelitů
- TXT formát V2 s UTC, epoch, monotónním časem, session ID a pořadovým číslem
- poslední známá poloha připojená k následujícím záznamům jako výslovně označený `last_location`

## Důležité omezení

Rozsah mobilních dat určuje modem, výrobce telefonu a Android. Sousední buňky bez MCC/MNC jsou uložené jako `operator=UNKNOWN`; operátor se nikdy neodhaduje pouze z PCI. Aktivní PLMN scan obvykle vyžaduje carrier privileges nebo systémové oprávnění a běžná instalace jej může odmítnout.

## Soubor

- APK: `SignalCollector-PoC-0.2.0.apk`
- SHA-256: `42011eee6d14a680b202b7407f8056326d04e74ff8881010ee387f03121c08b5`

## Ověření na telefonu

Verze byla nainstalována a otestována na telefonu Google Pixel 10a s Androidem 16. Testovací export obsahoval mobilní buňky včetně sousedních buněk, podrobnosti Wi-Fi, polohu a jednotlivé GNSS satelity.
