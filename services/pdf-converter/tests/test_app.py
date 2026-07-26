"""A FastAPI réteg tesztjei — mockolt konverzióval (nem kell soffice)."""

from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient

import app as app_module
from app import app
from converter import ConversionTimeoutError, ConverterNotAvailableError, InvalidOutputError

client = TestClient(app, raise_server_exceptions=False)


def ervenyes_pdf() -> bytes:
    from pypdf import PdfWriter

    iro = PdfWriter()
    iro.add_blank_page(width=200, height=200)
    puffer = io.BytesIO()
    iro.write(puffer)
    return puffer.getvalue()


@pytest.fixture(autouse=True)
def alaphelyzet(monkeypatch):
    # Alapból token nélküli mód; a konverzió mock (nincs soffice-függés).
    monkeypatch.setattr(app_module, "CONVERTER_TOKEN", "")
    monkeypatch.setattr(app_module, "convert_docx_to_pdf", lambda body, timeout_s=45: ervenyes_pdf())


def test_health():
    valasz = client.get("/health")
    assert valasz.status_code == 200
    assert valasz.json()["status"] == "ok"


def test_convert_sikeres_pdf():
    valasz = client.post("/convert", content=b"docx-bajtok")
    assert valasz.status_code == 200
    assert valasz.headers["content-type"] == "application/pdf"
    assert valasz.content.startswith(b"%PDF-")


def test_convert_ures_torzs_422():
    assert client.post("/convert", content=b"").status_code == 422


def test_convert_token_kell_ha_be_van_allitva(monkeypatch):
    monkeypatch.setattr(app_module, "CONVERTER_TOKEN", "titok123")
    # nincs fejléc → 401
    assert client.post("/convert", content=b"docx").status_code == 401
    # rossz token → 401
    assert client.post("/convert", content=b"docx", headers={"Authorization": "Bearer rossz"}).status_code == 401
    # helyes token → 200
    ok = client.post("/convert", content=b"docx", headers={"Authorization": "Bearer titok123"})
    assert ok.status_code == 200


@pytest.mark.parametrize(
    "hiba,kod",
    [
        (ConverterNotAvailableError("nincs soffice"), 503),
        (ConversionTimeoutError("timeout"), 504),
        (InvalidOutputError("rossz pdf"), 502),
    ],
)
def test_convert_hibalekepezes(monkeypatch, hiba, kod):
    def dobo(body, timeout_s=45):
        raise hiba

    monkeypatch.setattr(app_module, "convert_docx_to_pdf", dobo)
    assert client.post("/convert", content=b"docx").status_code == kod
