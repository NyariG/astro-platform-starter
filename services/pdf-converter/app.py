"""FastAPI réteg a DOCX → PDF konverzióhoz.

Végpontok:
    GET  /health   → életjel (Render health check)
    POST /convert  → DOCX (nyers törzs) → PDF

Hitelesítés: ha a ``CONVERTER_TOKEN`` env be van állítva, a ``/convert``
``Authorization: Bearer <token>`` fejlécet vár, konstans idejű összehasonlítással.
A titok soha nem kerül naplóba.
"""

from __future__ import annotations

import logging
import os
import secrets

from fastapi import FastAPI, Header, HTTPException, Request, Response
from fastapi.concurrency import run_in_threadpool

from converter import (
    ConversionTimeoutError,
    ConverterError,
    ConverterNotAvailableError,
    InvalidOutputError,
    convert_docx_to_pdf,
    soffice_elerheto,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("pdf-converter.app")

CONVERTER_TOKEN = os.environ.get("CONVERTER_TOKEN", "")
CONVERT_TIMEOUT_S = int(os.environ.get("CONVERT_TIMEOUT_S", "45"))
MAX_MERET_BAJT = int(os.environ.get("MAX_DOCX_BYTES", str(25 * 1024 * 1024)))  # 25 MB védőkorlát

app = FastAPI(title="Nyári Terv PDF konverter", docs_url=None, redoc_url=None)


def _ellenorizd_token(authorization: str | None) -> None:
    """A Bearer-token konstans idejű ellenőrzése, ha be van állítva a titok."""
    if not CONVERTER_TOKEN:
        return  # token nélküli mód (pl. lokális fejlesztés)
    vart = f"Bearer {CONVERTER_TOKEN}"
    if not authorization or not secrets.compare_digest(authorization, vart):
        raise HTTPException(status_code=401, detail="Érvénytelen vagy hiányzó token.")


@app.get("/health")
def health() -> dict[str, object]:
    """Életjel a load balancer / Render health checkhez."""
    return {"status": "ok", "soffice": soffice_elerheto()}


@app.post("/convert")
async def convert(request: Request, authorization: str | None = Header(default=None)) -> Response:
    """DOCX (nyers kéréstörzs) → PDF válasz.

    Válaszkódok: 200 (PDF), 401 (token), 413 (túl nagy), 422 (üres),
    502 (érvénytelen kimenet), 503 (soffice nem elérhető),
    504 (timeout), 500 (egyéb konverziós hiba).
    """
    _ellenorizd_token(authorization)

    body = await request.body()
    if not body:
        raise HTTPException(status_code=422, detail="Üres kérés törzs — DOCX bájtok szükségesek.")
    if len(body) > MAX_MERET_BAJT:
        raise HTTPException(status_code=413, detail="A dokumentum túl nagy.")

    try:
        # A konverzió blokkoló (soffice subprocess) — szálkészletben futtatjuk,
        # hogy a párhuzamos kérések ne blokkolják egymást az event loopon.
        pdf = await run_in_threadpool(convert_docx_to_pdf, body, timeout_s=CONVERT_TIMEOUT_S)
    except ConverterNotAvailableError as hiba:
        logger.error("soffice nem elérhető: %s", hiba)
        raise HTTPException(status_code=503, detail="A konverziós motor nem elérhető.") from hiba
    except ConversionTimeoutError as hiba:
        logger.error("konverziós timeout: %s", hiba)
        raise HTTPException(status_code=504, detail="A konverzió túllépte az időkorlátot.") from hiba
    except InvalidOutputError as hiba:
        logger.error("érvénytelen kimenet: %s", hiba)
        raise HTTPException(status_code=502, detail="A konverzió érvénytelen kimenetet adott.") from hiba
    except ConverterError as hiba:
        logger.error("konverziós hiba: %s", hiba)
        raise HTTPException(status_code=500, detail="A konverzió sikertelen.") from hiba

    return Response(content=pdf, media_type="application/pdf")
