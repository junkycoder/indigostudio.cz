# Signal Collector 0.3.0

Verze 0.3.0 přidává full-tracking raw GNSS měření, GNSS navigační zprávy, NMEA, Wi-Fi RTT/FTM, kompletní BLE advertising payload a podrobný síťový kontext. TXT export zůstává ve formátu V2 a nové zdroje lze analyzovat společně se záznamy z verze 0.2.0.

## Nové zdroje

- `gnss_raw`: clock, jednotlivá měření a AGC včetně pseudorange rate, ADR, carrier a bias údajů
- `gnss_navigation`: binární navigační zprávy v hexadecimálním tvaru
- `gnss_nmea`: úplné NMEA věty
- `gnss_antenna`: anténní charakteristiky, pokud je telefon poskytne
- `wifi_rtt`: RTT/FTM vzdálenost, odchylka, RSSI, LCI/LCR a stav dostupnosti
- `network_context`: transporty, schopnosti, IP adresy, DNS, routy, MTU a změnové události
- `bluetooth_ble`: raw advertising bytes, manufacturer/service data, PHY, SID a interval

## Ověření

Release APK bylo ověřeno na Google Pixel 10a s Androidem 16. Test dlouhý 24 sekund vytvořil 4 328 záznamů, mimo jiné 219 jednotlivých raw GNSS měření, 23 GNSS clock záznamů, 61 AGC záznamů, 13 navigačních zpráv, 319 NMEA vět, 491 BLE reklam a síťové capabilities/link properties. V dosahu nebyl RTT-capable access point, proto Wi-Fi RTT korektně zapsalo `NO_RESPONDERS`.

APK SHA-256: `64d0532c92d601563fefe21a99ac5171ce9bca0efb09291cbb96470524f91077`
