"""DOCX → PDF konverziós mag LibreOffice (soffice) headless motorral.

Állapotmentes: bájtok be, bájtok ki. A hívásonként izolált LibreOffice
felhasználói profil (``-env:UserInstallation``) teszi konkurencia-biztossá —
párhuzamos konverziók nem ütköznek egymás profiljában.

A modul nem függ a webrétegtől; önállóan tesztelhető.
"""

from __future__ import annotations

import io
import logging
import os
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

logger = logging.getLogger("pdf-converter.converter")

# A soffice bináris neve/útja környezetből felülírható (a Docker-image-ben "soffice").
SOFFICE_BIN = os.environ.get("SOFFICE_BIN", "soffice")

# A LibreOffice PDF-exportszűrő neve — a Writer PDF-exportot kényszeríti ki.
_PDF_FILTER = "pdf:writer_pdf_Export"


class ConverterError(Exception):
    """A konverzió általános hibája (soffice hibakód, hiányzó kimenet)."""


class ConverterNotAvailableError(ConverterError):
    """A soffice bináris nem található a rendszeren."""


class ConversionTimeoutError(ConverterError):
    """A konverzió túllépte a megadott időkorlátot."""


class InvalidOutputError(ConverterError):
    """A kimenet nem érvényes PDF (üres, rossz fejléc vagy nulla oldal)."""


def soffice_elerheto() -> bool:
    """Igaz, ha a soffice bináris megtalálható a PATH-on vagy a megadott úton."""
    return shutil.which(SOFFICE_BIN) is not None or os.path.isfile(SOFFICE_BIN)


def _validald_pdf(adat: bytes) -> None:
    """Ellenőrzi, hogy a bájtok érvényes, legalább egy oldalas PDF-et adnak-e.

    Raises:
        InvalidOutputError: ha a kimenet üres, nem PDF-fejlécű, vagy 0 oldalas.
    """
    if len(adat) < 100 or not adat.startswith(b"%PDF-"):
        raise InvalidOutputError("A kimenet nem érvényes PDF (hiányzó %PDF- fejléc).")
    try:
        from pypdf import PdfReader

        oldalak = len(PdfReader(io.BytesIO(adat)).pages)
    except InvalidOutputError:
        raise
    except Exception as hiba:  # a pypdf saját hibái
        raise InvalidOutputError(f"A PDF nem olvasható: {hiba}") from hiba
    if oldalak < 1:
        raise InvalidOutputError("A PDF nem tartalmaz oldalt.")


def convert_docx_to_pdf(docx_bytes: bytes, *, timeout_s: int = 45) -> bytes:
    """Egy DOCX bájtsort PDF bájtsorrá alakít a soffice headless motorral.

    Args:
        docx_bytes: a bemeneti DOCX teljes tartalma.
        timeout_s: a soffice-hívás időkorlátja másodpercben.

    Returns:
        A kész PDF bájtjai.

    Raises:
        InvalidOutputError: üres bemenet vagy érvénytelen kimenet esetén.
        ConverterNotAvailableError: ha a soffice nem elérhető.
        ConversionTimeoutError: ha a konverzió túllépi az időkorlátot.
        ConverterError: a soffice bármely más hibája esetén.
    """
    if not docx_bytes:
        raise InvalidOutputError("Üres DOCX bemenet.")
    if not soffice_elerheto():
        raise ConverterNotAvailableError(f"A soffice bináris nem található: {SOFFICE_BIN!r}")

    kezdet = time.monotonic()
    # A TemporaryDirectory garantáltan takarít a with-blokk végén, hibánál is.
    with tempfile.TemporaryDirectory(prefix="pdfconv-") as tmp:
        tmpdir = Path(tmp)
        bemenet = tmpdir / "input.docx"
        kimenet_dir = tmpdir / "out"
        kimenet_dir.mkdir()
        profil = tmpdir / "profile"  # hívásonként izolált LibreOffice-profil
        bemenet.write_bytes(docx_bytes)

        parancs = [
            SOFFICE_BIN,
            "--headless",
            "--norestore",
            "--nolockcheck",
            f"-env:UserInstallation=file://{profil}",
            "--convert-to",
            _PDF_FILTER,
            "--outdir",
            str(kimenet_dir),
            str(bemenet),
        ]

        try:
            # shell=False (lista alak), így nincs shell-injection.
            eredmeny = subprocess.run(parancs, capture_output=True, timeout=timeout_s, check=False)
        except subprocess.TimeoutExpired as hiba:
            raise ConversionTimeoutError(f"A konverzió túllépte a {timeout_s}s időkorlátot.") from hiba

        pdfek = list(kimenet_dir.glob("*.pdf"))
        if eredmeny.returncode != 0 or not pdfek:
            stderr = eredmeny.stderr.decode("utf-8", "replace")[:500]
            raise ConverterError(f"soffice hiba (rc={eredmeny.returncode}): {stderr}")

        pdf_bytes = pdfek[0].read_bytes()
        _validald_pdf(pdf_bytes)

        logger.info(
            "konverzió kész",
            extra={"be_bajt": len(docx_bytes), "ki_bajt": len(pdf_bytes), "ido_ms": round((time.monotonic() - kezdet) * 1000)},
        )
        return pdf_bytes
