"""A konverziós mag tesztjei — mockolt soffice-szal és egy valós (skippelhető) körrel."""

from __future__ import annotations

import io
import subprocess
from pathlib import Path

import pytest

import converter
from converter import (
    ConversionTimeoutError,
    ConverterError,
    ConverterNotAvailableError,
    InvalidOutputError,
    convert_docx_to_pdf,
    soffice_elerheto,
)


def ervenyes_pdf() -> bytes:
    """Egy érvényes, egyoldalas PDF bájtjai (pypdf-fel előállítva)."""
    from pypdf import PdfWriter

    iro = PdfWriter()
    iro.add_blank_page(width=200, height=200)
    puffer = io.BytesIO()
    iro.write(puffer)
    return puffer.getvalue()


def _fake_run_gyar(*, rc: int = 0, ir_pdf: bool = True, pdf: bytes | None = None):
    """subprocess.run helyettesítő, ami a --outdir-ba ír egy PDF-et és adott rc-t ad."""
    pdf_tartalom = pdf if pdf is not None else ervenyes_pdf()

    def fake_run(parancs, **_kwargs):
        outdir = Path(parancs[parancs.index("--outdir") + 1])
        if ir_pdf:
            (outdir / "input.pdf").write_bytes(pdf_tartalom)
        return subprocess.CompletedProcess(parancs, rc, stdout=b"", stderr=b"" if rc == 0 else b"soffice elszallt")

    return fake_run


# ── _validald_pdf ────────────────────────────────────────────────

def test_validald_elfogadja_az_ervenyes_pdfet():
    converter._validald_pdf(ervenyes_pdf())  # nem dob


@pytest.mark.parametrize("adat", [b"", b"nem pdf", b"%PDF-" + b"\x00" * 10])
def test_validald_elutasit_az_ervenytelent(adat):
    with pytest.raises(InvalidOutputError):
        converter._validald_pdf(adat)


# ── convert_docx_to_pdf (mockolt soffice) ────────────────────────

def test_ures_bemenet_hibat_dob():
    with pytest.raises(InvalidOutputError):
        convert_docx_to_pdf(b"")


def test_hianyzo_soffice_hibat_dob(monkeypatch):
    monkeypatch.setattr(converter, "soffice_elerheto", lambda: False)
    with pytest.raises(ConverterNotAvailableError):
        convert_docx_to_pdf(b"akarmi")


def test_sikeres_konverzio(monkeypatch):
    monkeypatch.setattr(converter, "soffice_elerheto", lambda: True)
    monkeypatch.setattr(subprocess, "run", _fake_run_gyar())
    pdf = convert_docx_to_pdf(b"docx-bajtok")
    assert pdf.startswith(b"%PDF-")


def test_soffice_hibakod_hibat_dob(monkeypatch):
    monkeypatch.setattr(converter, "soffice_elerheto", lambda: True)
    monkeypatch.setattr(subprocess, "run", _fake_run_gyar(rc=1, ir_pdf=False))
    with pytest.raises(ConverterError):
        convert_docx_to_pdf(b"docx-bajtok")


def test_timeout_hibat_dob(monkeypatch):
    monkeypatch.setattr(converter, "soffice_elerheto", lambda: True)

    def timeout_run(parancs, **_kwargs):
        raise subprocess.TimeoutExpired(parancs, 45)

    monkeypatch.setattr(subprocess, "run", timeout_run)
    with pytest.raises(ConversionTimeoutError):
        convert_docx_to_pdf(b"docx-bajtok", timeout_s=45)


def test_ervenytelen_kimenet_hibat_dob(monkeypatch):
    # soffice „sikeres", de a kimenet nem valódi PDF.
    monkeypatch.setattr(converter, "soffice_elerheto", lambda: True)
    monkeypatch.setattr(subprocess, "run", _fake_run_gyar(pdf=b"ez nem pdf"))
    with pytest.raises(InvalidOutputError):
        convert_docx_to_pdf(b"docx-bajtok")


# ── Valós konverzió (skippel, ha nincs soffice) ──────────────────

REPO_SABLON = Path(__file__).resolve().parents[3] / "src/utils/ajanlat/pdf/template.docx"


@pytest.mark.skipif(not soffice_elerheto(), reason="A soffice nem elérhető ezen a gépen (a Docker-image-ben lesz).")
@pytest.mark.skipif(not REPO_SABLON.is_file(), reason="A repó sablonja nem található.")
def test_valos_konverzio_a_repo_sablonjaval():
    pdf = convert_docx_to_pdf(REPO_SABLON.read_bytes())
    assert pdf.startswith(b"%PDF-")
    from pypdf import PdfReader

    assert len(PdfReader(io.BytesIO(pdf)).pages) >= 1
