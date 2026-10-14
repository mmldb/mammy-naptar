# Nagyi Naptár

Mobilra optimalizált, közös családi naptár. A felület Supabase nélkül helyi próbaüzemben indul; ilyenkor a bejegyzések csak az adott böngészőben maradnak meg.

## Helyi kipróbálás

Statikus webszerverrel szolgáld ki a mappát, majd nyisd meg a kapott címet. A `file://` megnyitás helyett webszerver javasolt.

## Supabase bekötése

1. Hozz létre egy ingyenes Supabase-projektet.
2. Futtasd a `supabase.sql` tartalmát az SQL Editorban.
3. Hozd létre az engedélyezett családtagokat az Authentication / Users felületen.
4. Minden felhasználóhoz hozz létre egy `profiles` sort a fájl végén látható minta alapján.
5. A `config.js` fájl tartalmazza az OD 4 projekt URL-jét és nyilvános publishable kulcsát.

Az Authentication beállításokban az önálló regisztráció maradjon kikapcsolva. Így csak a Supabase vezérlőpultján előre létrehozott családtagok tudnak belépni.

Kizárólag a nyilvános publishable/anon kulcs kerülhet a weboldalba. A `service_role` kulcsot tilos a frontendben vagy GitHubon tárolni.

## Ingyenes publikálás

A mappa tartalma közvetlenül publikálható GitHub Pagesre. A forráskód nyilvános lehet, mert az adatvédelmet a Supabase-bejelentkezés és a Row Level Security szabályai biztosítják; titkos kulcs nem kerül a repóba.

## Telepítés telefonra

Az alkalmazás PWA-ként telepíthető. Androidon a Chrome menüjében az `Alkalmazás telepítése` vagy `Hozzáadás a kezdőképernyőhöz`, iPhone-on a Safari megosztási menüjében a `Főképernyőhöz adás` pontot kell választani.

A felület, a manifest és az ikonok offline gyorsítótárban maradnak. A közös Supabase-adatok olvasásához és szinkronizálásához internetkapcsolat szükséges.
