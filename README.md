# RTMP Control Room

Webes kezelofelulet egy NodeMediaServer alapu RTMP ingest szerverhez. A dashboard jelszoval vedett, egyedi streamkulcsot kezel, es elinditja vagy leallitja az RTMP szolgaltatast.

## Inditas

Node.js 20 vagy ujabb szukseges.

```sh
npm install
npm start
```

Nyisd meg a `http://localhost:3000` cimet. Ha nincs megadva `DASHBOARD_PASSWORD`, az inditasi konzol kiir egy veletlenszeru jelszot. A szerver indulaskor automatikusan figyel a `1935/tcp` porton.

Kornyezeti valtozok:

| Valtozo | Alapertelmezett | Cel |
| --- | --- | --- |
| `PORT` | `3000` | Webes dashboard portja |
| `RTMP_PORT` | `1935` | RTMP port |
| `HTTP_FLV_PORT` | `8000` | Böngészős HTTP-FLV lejátszó portja |
| `DASHBOARD_PASSWORD` | Veletlenszeru inditaskor | Dashboard jelszava |
| `PUBLIC_HOST` | Ures | A megjelenitett publikus DNS-nev vagy IP-cim |
| `DASHBOARD_COOKIE_SECURE` | `false` | `true`, ha a dashboard HTTPS proxy mogott fut |
| `DASHBOARD_ORIGIN` | Ures | Az egyetlen engedelyezett kulso dashboard-origin, peldaul `https://felhasznalonev.github.io` |
| `DASHBOARD_COOKIE_SAME_SITE` | `Strict` | `None` kulon domainen futo Pages felulethez; ilyenkor a Secure automatikusan kotelezo |
| `HTTP_FLV_PUBLIC_URL` | Ures | HTTPS reverse proxy publikus cime a Pages-es eloelozethez |

A streamkulcs es a hostbeallitas a `data/state.json` fajlba kerul. Ezt a fajlt es a streamkulcsot kezeld titokkent.

## OBS beallitas

Az iranyitopulton add meg azt a publikus DNS-nevet vagy IPv4-cimet, amelyrol a streamelok elerik a szervert. OBS-ben valaszd az egyedi RTMP celt, es hasznald a dashboardon lathato szerver URL-t es streamkulcsot.

## Tavoli eleres

A webes felulet onmagaban nem teszi publikussa a szervert. Tavoli halozatrol valo RTMP-kapcsolathoz az alkalmazasnak folyamatosan futo, publikus IPv4-cimmel vagy DNS-nevvel rendelkezo gepen kell futnia. Otthoni gep eseten a routeren tovabbitsd a TCP `1935` portot erre a gepre, es engedelyezd ugyanezt a tuzfalon. CGNAT mogott a routeres porttovabbitas nem eleg; publikus IP-vel rendelkezo VPS-re vagy megfelelo TCP tunneling szolgaltatasra van szukseg.

A dashboardon beluli böngészős előnézethez a HTTP-FLV portnak (alapértelmezetten `8000`) is elérhetőnek kell lennie. Az OBS-beállításhoz a `1935/tcp` portot használd; a webes lejátszáshoz a `8000/tcp` portot is nyisd meg.

A Codespaces/webes fejlesztoi porttovabbitas nem garantal nyers TCP/RTMP elerest. Eles, internetrol elerheto hasznalathoz telepitsd VPS-re vagy sajat publikus szerverre, es allits be TLS-t a dashboard ele. HTTPS dashboard mellett a böngészős élő képhez a HTTP-FLV kimenetet is HTTPS proxy mögé kell tenni. A dashboardot ne tedd jelszo nelkul nyilvanossa.

## GitHub Pages

Az `rtmpserver` GitHub Pages oldala egy statikus telefonkamera-eszkoz. A Pages workflow a `main` agra torteno push utan automatikusan telepiti, kulon backend URL vagy Actions valtozo nem szukseges.

Az oldalon generalj kulon kuldo- es OBS-linket. Nyisd meg a kuldo-linket az Android telefonon, engedelyezd a kamera- es mikrofonhozzaferest, majd az OBS-ben adj hozza egy Browser Source-t az OBS-linkkel. A kepet a VDO.Ninja tovabbitja; a telefon es az OBS kozotti eloben kozvetiteshez a sajat Node/RTMP szerver nem szukseges. A hivatkozast kezeld privatkent: aki megkapja az OBS-linket, megnezheti az adast.

A Pages forrasat a repository `Settings > Pages` oldalan `GitHub Actions`-re kell allitani. A regi NodeMediaServer-es kezelopult tovabbra is helyben futtathato `npm start` paranccsal, de GitHub Pages nem futtat Node.js-t vagy RTMP-t.