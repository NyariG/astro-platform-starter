# Nyári Terv — DOCX → PDF konverziós szolgáltatás

Önálló, állapotmentes mikroszolgáltatás: a kitöltött árajánlat-DOCX-et
PDF-fé alakítja **LibreOffice** (soffice) headless motorral — ugyanaz a
motor, mint amit a CloudConvert használ, így a PDF-hűség egyezik.

A fő alkalmazás (Astro/Netlify) hívja HTTP-n keresztül. A LibreOffice nem
futtatható a Netlify serverlessben, ezért fut külön, saját hoszton (Render).

## Végpontok

| Metódus | Út | Leírás |
|---|---|---|
| `GET` | `/health` | Életjel: `{"status":"ok","soffice":true}` |
| `POST` | `/convert` | Törzs: nyers DOCX bájtok → válasz: `application/pdf` |

A `/convert` `Authorization: Bearer <CONVERTER_TOKEN>` fejlécet vár, ha a
`CONVERTER_TOKEN` env be van állítva.

## Környezeti változók

| Változó | Jelentés | Alapérték |
|---|---|---|
| `CONVERTER_TOKEN` | megosztott titok a Bearer-hitelesítéshez | — (üres = nincs auth) |
| `CONVERT_TIMEOUT_S` | egy konverzió időkorlátja (mp) | `45` |
| `MAX_DOCX_BYTES` | maximális bemeneti méret | `26214400` (25 MB) |
| `SOFFICE_BIN` | a soffice bináris neve/útja | `soffice` |
| `PORT` | a kiszolgáló portja | `8000` |

## Deploy Renderre

1. **New → Blueprint**, és mutass a repóra — a `services/pdf-converter/render.yaml` felismerődik.
   (Vagy: **New → Web Service → Docker**, a Dockerfile ezen a mappán.)
2. A `CONVERTER_TOKEN` titkot add meg a Render felületén (Environment).
3. Deploy után az URL (pl. `https://nyariterv-pdf-converter.onrender.com`) kerüljön a
   Netlify **`PDF_CONVERTER_URL`** env-jébe, a token pedig a **`PDF_CONVERTER_TOKEN`**-be.
4. Hidegindítás-mentes kiszolgáláshoz **always-on (starter) terv** ajánlott; a free
   terv hidegindítása a Netlify-oldali rövid timeout miatt a CloudConvert fallbackre eshet.

## Lokális futtatás és teszt

```bash
cd services/pdf-converter
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
pytest -q                       # egységtesztek (a valós konverzió skippel, ha nincs soffice)

# Valós konverzió Dockerrel:
docker build -t nyariterv-pdf .
docker run --rm -p 8000:8000 -e CONVERTER_TOKEN=teszt nyariterv-pdf
# másik terminálban:
curl -X POST http://localhost:8000/convert \
  -H "Authorization: Bearer teszt" \
  --data-binary @../../src/utils/ajanlat/pdf/template.docx \
  -o proba.pdf
```

## Fontok / vizuális hűség

A Docker-image a `fonts-liberation` csomagot telepíti: a **Liberation Serif/Sans**
metrikakompatibilis a sablon **Times New Roman / Arial** betűivel, így a szélességek
és a tördelés gyakorlatilag azonosak. A sablon egyetlen bájtja sem változik — a
szolgáltatás csak renderel.
