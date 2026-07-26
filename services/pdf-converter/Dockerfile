# Nyári Terv — DOCX → PDF konverziós szolgáltatás.
#
# A LibreOffice (Writer) végzi a renderelést; ugyanaz a motor, amit a
# CloudConvert is használ, így a PDF-hűség egyezik. A Liberation fontok
# metrikakompatibilis helyettesítők a sablon Times New Roman / Arial
# betűihez (a DOCX megjelenése így nem torzul).
FROM python:3.12-slim

# Rendszercsomagok: LibreOffice Writer + Liberation fontok.
# A --no-install-recommends és a lista-takarítás kicsiben tartja az image-et.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libreoffice-writer \
        fonts-liberation \
    && fc-cache -f \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py converter.py ./

# A soffice a PATH-on van a libreoffice-writer csomagból.
ENV SOFFICE_BIN=soffice
# A Render a $PORT env-et adja; lokálisan 8000 az alapértelmezett.
ENV PORT=8000
EXPOSE 8000

# Egyetlen worker: a LibreOffice a szűk keresztmetszet, a konkurenciát a
# hívásonként izolált profil kezeli. Vízszintes skálázás példányszinten történik.
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
