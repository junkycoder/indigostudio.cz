# Vývojářská instalace

## Android Studio

1. Otevřete složku `signal-collector-android` v Android Studiu.
2. Počkejte na dokončení Gradle Sync.
3. Připojte telefon kabelem USB-C.
4. V telefonu otevřete **Nastavení → Informace o telefonu** a sedmkrát klepněte na **Číslo sestavení**.
5. V **Možnostech pro vývojáře** zapněte **Ladění USB**.
6. Potvrďte otisk počítače zobrazený v telefonu.
7. V Android Studiu vyberte telefon a spusťte konfiguraci `app`.

## Přímá instalace APK

1. Vytvořte APK pomocí **Build → Build APK(s)**.
2. Soubor najdete v `app/build/outputs/apk/debug/app-debug.apk`.
3. Přeneste APK do telefonu a otevřete jej.
4. Na výzvu Androidu povolte instalaci aplikací z použitého zdroje.
5. Nainstalujte aplikaci Signal Collector.

## První spuštění

Po stisku **Start** aplikace požádá o polohu, mikrofon, okolní zařízení, telefonní síť a notifikace. Lze pokračovat i po zamítnutí části oprávnění; odpovídající zdroje pouze nebudou sbírány.

Pro spolehlivé dlouhé měření ponechte aplikaci bez omezení baterie v **Nastavení → Aplikace → Signal Collector → Baterie**. Během měření musí být zobrazena trvalá notifikace.

## Ověření instalace

1. Spusťte měření na dvě minuty.
2. Zamkněte obrazovku alespoň na 30 sekund.
3. Telefon odemkněte a měření zastavte.
4. Zkontrolujte, že počet záznamů narostl.
5. Použijte **Export TXT** a soubor otevřete.
