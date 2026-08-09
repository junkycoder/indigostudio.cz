# Verze 0.5.0

## Nejdůležitější změny

- experimentální aktivní mobilní scan má jednoznačné události `ACTIVE_NETWORK_SCAN_REQUESTED`, `ACTIVE_NETWORK_SCAN_STARTED`, `ACTIVE_NETWORK_SCAN_RESULT`, `ACTIVE_NETWORK_SCAN_COMPLETE` a `ACTIVE_NETWORK_SCAN_FAILED`
- neúspěšný aktivní scan ukládá číselný kód, typ výjimky, zprávu, stav carrier privileges a stav privilegovaného oprávnění `MODIFY_PHONE_STATE`
- každý výsledek aktivního scanu zůstává oddělený od pasivních buněk přes `scan_mode=ACTIVE_NETWORK_SCAN` a obsahuje jen operátora, kterého poskytl Android; neznámý operátor zůstává `UNKNOWN`
- skutečný speedtest lze ručně spustit zvlášť přes `MOBILE`, `WIFI` nebo sekvenčně přes `BOTH`; provoz je přes Android `Network` skutečně navázán na požadovaný transport
- souhrnný `speed_test_result` obsahuje download/upload Mb/s, bajty a časy, minimum/průměr/medián/maximum/p95 RTT, jitter, packet loss, počet chyb a server
- k výsledku speedtestu se připojí poslední dostupný kontext mobilní buňky nebo Wi-Fi spojení
- automatický plný test lze nastavit na `OFF`, 5, 10, 15 nebo 30 minut; výchozí stav je `OFF`
- předvolby technologií, jejich intervaly a cílová síť testu se zachovají po restartu aplikace
- měření pokračuje na pozadí přes foreground službu a poslední dokončené nebo přerušené měření zůstává dostupné do Resetu
- zjednodušené ovládání používá stálý Start, Reset a červený Stop; stav sběru a test internetu mají stabilní ztlumené místo v rozhraní
- volby testu `MOBILE`, `WIFI` a `BOTH` se povolují podle skutečně dostupných ověřených sítí
- oprávnění se připravují při zapnutí technologie, ne až při spuštění měření
- TXT lze stáhnout nebo sdílet přes systémový panel; od odhadovaných 10 MB se automaticky předvolí GZIP

## Ověření referenčního telefonu

Google Pixel 10a s Androidem 16 poskytuje stejné veřejné pasivní LTE/5G API a rádiové parametry požadované pro Samsung S25 Ultra. `requestNetworkScan()` je na běžném telefonu chráněn carrier privileges nebo systémovým oprávněním `MODIFY_PHONE_STATE`; verze 0.5.0 proto vždy zaznamená skutečný pokus a přesný důvod odmítnutí místo toho, aby podporu pouze odhadovala podle značky telefonu.

Test na referenčním Pixelu vytvořil posloupnost `ACTIVE_NETWORK_SCAN_REQUESTED` → `ACTIVE_NETWORK_SCAN_FAILED` s `exception=SecurityException`, `has_carrier_privileges=false` a `modify_phone_state_granted=false`. Vynucený Wi-Fi speedtest skončil stavem `SUCCESS`, obsahoval všechny požadované metriky a po výběru nejúplnějšího Android Wi-Fi zdroje také skutečné SSID/BSSID a linkové parametry.
