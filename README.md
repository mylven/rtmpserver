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
| `DASHBOARD_PASSWORD` | Veletlenszeru inditaskor | Dashboard jelszava |
| `PUBLIC_HOST` | Ures | A megjelenitett publikus DNS-nev vagy IP-cim |
| `DASHBOARD_COOKIE_SECURE` | `false` | `true`, ha a dashboard HTTPS proxy mogott fut |

A streamkulcs es a hostbeallitas a `data/state.json` fajlba kerul. Ezt a fajlt es a streamkulcsot kezeld titokkent.

## OBS beallitas

Az iranyitopulton add meg azt a publikus DNS-nevet vagy IPv4-cimet, amelyrol a streamelok elerik a szervert. OBS-ben valaszd az egyedi RTMP celt, es hasznald a dashboardon lathato szerver URL-t es streamkulcsot.

## Tavoli eleres

A webes felulet onmagaban nem teszi publikussa a szervert. Tavoli halozatrol valo RTMP-kapcsolathoz az alkalmazasnak folyamatosan futo, publikus IPv4-cimmel vagy DNS-nevvel rendelkezo gepen kell futnia. Otthoni gep eseten a routeren tovabbitsd a TCP `1935` portot erre a gepre, es engedelyezd ugyanezt a tuzfalon. CGNAT mogott a routeres porttovabbitas nem eleg; publikus IP-vel rendelkezo VPS-re vagy megfelelo TCP tunneling szolgaltatasra van szukseg.

A Codespaces/webes fejlesztoi porttovabbitas nem garantal nyers TCP/RTMP elerest. Eles, internetrol elerheto hasznalathoz telepitsd VPS-re vagy sajat publikus szerverre, es allits be TLS-t a dashboard ele. A dashboardot ne tedd jelszo nelkul nyilvanossa.