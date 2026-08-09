# Signal Collector 0.4.0

Verze 0.4.0 doplňuje tři hlavní požadavky z dlouhého jízdního testu: experimentální scan dalších mobilních operátorů, skutečné měření kvality internetu a komprimovaný export velkých relací.

## Novinky

- aktivní network scan loguje stavy `REQUESTED`, `ACCEPTED`, `RESULTS`, `COMPLETE`, `ERROR` nebo `REJECTED`
- buňky z aktivního scanu mají `scan_mode=ACTIVE_NETWORK_SCAN`
- změna serving cell vytváří událost `SERVING_CELL_CHANGED`
- volitelný modul Kvalita internetu měří HTTPS RTT, jitter a ztrátovost
- ruční test měří reálný download a upload přes aktuální Wi-Fi nebo mobilní síť
- ZIP export automaticky dělí TXT po 50 MB, přibyl také GZIP export
- obrazovka za běhu ukazuje stav hlavních sběrných modulů
- Bluetooth Classic odlišuje skutečný discovery od seznamu spárovaných zařízení
- GNSS summary obsahuje poměr satelitů použitých ve fixu a souhrn C/N0

Všechny dosavadní senzory a rádiové zdroje zůstávají dostupné. Internetový test je kvůli spotřebě dat ve výchozím stavu vypnutý.

## Omezení Androidu

Aktivní network scan může běžná aplikace bez oprávnění operátora odmítnout. Aplikace výsledek neodhaduje a do exportu uloží přesný stav a chybu vrácenou telefonem.
