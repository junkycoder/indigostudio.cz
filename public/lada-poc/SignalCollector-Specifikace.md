# Specifikace PoC – Signal Collector

## Cíl

Vytvořit nativní Android aplikaci pro interní použití mimo Google Play. Aplikace funguje offline, průběžně sbírá dostupná data telefonu, ukládá je lokálně a exportuje ukončené měření do TXT.

## Rozsah

- Kotlin, Jetpack Compose, Room/SQLite a Foreground Service
- Android 12 a novější
- Start, Stop, stav, délka a počet záznamů
- GPS, Wi-Fi, mobilní síť, Bluetooth Classic, BLE
- akcelerometr, gyroskop, magnetometr, barometr, světlo, přiblížení a Rotation Vector
- orientační hlukoměr RMS/dBFS bez ukládání zvuku
- pokračování měření při nedostupném senzoru nebo zamítnutém oprávnění
- lokální TXT export se systémovými a monotónními časovými značkami

## Mimo rozsah

Cloud, uživatelské účty, veřejná distribuce, iOS, CSV/JSON, mapa, zvukové nahrávky, video, převod řeči, kalibrovaný hlukoměr a AI analytika.

## Akceptace PoC

APK lze nainstalovat mimo obchod, měření lze spustit a zastavit, data se zapisují se zamčenou obrazovkou a TXT export lze otevřít. Zamítnutí jednoho oprávnění ani chybějící senzor nesmí ukončit ostatní sběr.
