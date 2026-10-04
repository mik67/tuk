# Ťuk

Osobní deník pro rychlý zápis drobných ranních příhod a toho, co jim předcházelo.
Funguje na iPhonu i Androidu, instaluje se z odkazu a **data zůstávají jen ve vašem telefonu**.

Ťuk je osobní deník pro zápis a sdílení údajů, které si uživatel sám zapíše. Nehodnotí, nediagnostikuje,
nepředpovídá, nedává doporučení a nenahrazuje lékaře. Není zdravotnickým prostředkem.
V nouzi volejte 112 nebo 155.

Aplikace: https://mik67.github.io/tuk/ (otevřete v telefonu a přidejte na plochu)

## Co umí
- zápis jedním klepnutím, úprava a historie
- prosté počty (po týdnech, četnost štítků)
- záloha a obnova do souboru
- poslání souhrnu (PDF) a tabulky (CSV) přes sdílení v telefonu
- funguje bez připojení

## Soukromí
Aplikace po načtení nevolá žádný jiný server než ten, odkud byla stažena (vynucuje to Content-Security-Policy).
Žádná analytika, žádné cookies, žádné externí knihovny ani fonty. Hosting stránky může při stažení vidět IP adresu.

## Vývoj
`npm test` spustí testy, `npm run serve` spustí lokální server na http://localhost:8081.
Licence MIT.
