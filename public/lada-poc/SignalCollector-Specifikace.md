# Specifikace PoC – Signal Collector

## Cíl

Vytvořit nativní Android aplikaci pro interní použití mimo Google Play. Aplikace funguje offline, průběžně sbírá dostupná data telefonu, ukládá je lokálně a exportuje ukončené měření do TXT.

## Rozsah

- Kotlin, Jetpack Compose, Room/SQLite a Foreground Service
- Android 12 a novější
- Start, Stop, stav, délka a počet záznamů
- volba jednotlivých měřených zdrojů před startem; výchozí stav je vše zapnuto
- 1Hz GPS, jednotlivé GNSS satelity, raw GNSS měření, navigační zprávy a NMEA
- podrobná Wi-Fi, Wi-Fi 7 MLO a Wi-Fi RTT/FTM ranging
- kompletní BLE advertising payload a síťový kontext
- deep scan mobilních buněk pro každou aktivní SIM včetně LTE/NR/3G/2G getterových hodnot a callback událostí
- experimentální aktivní network scan jako samostatný opt-in režim s přesnými lifecycle a chybovými událostmi
- akcelerometr, gyroskop, magnetometr, barometr, světlo, přiblížení a Rotation Vector
- orientační hlukoměr RMS/dBFS bez ukládání zvuku
- pokračování měření při nedostupném senzoru nebo zamítnutém oprávnění
- lokální TXT nebo GZIP export se systémovými a monotónními časovými značkami
- nativní uložení a sdílení zvoleného formátu přes systémový panel Androidu
- volitelný periodický HTTPS RTT/jitter/loss test a ruční nebo plánovaný download/upload test vynucený zvlášť přes mobilní síť a Wi-Fi
- provozní přehled počtů a posledního stavu hlavních sběrných modulů
- samostatný Reset jako jediná akce, která smaže všechna uložená měření

## Mimo rozsah

Cloudové ukládání, uživatelské účty, veřejná distribuce, iOS, CSV/JSON, mapa, zvukové nahrávky, video, převod řeči, kalibrovaný hlukoměr a AI analytika.

## Akceptace PoC

APK lze nainstalovat mimo obchod, měření lze spustit a zastavit, data se zapisují se zamčenou obrazovkou a TXT export lze otevřít. Vypnutý zdroj nesmí vytvářet záznamy ani vyžadovat své oprávnění. Zamítnutí jednoho oprávnění ani chybějící senzor nesmí ukončit ostatní sběr.
