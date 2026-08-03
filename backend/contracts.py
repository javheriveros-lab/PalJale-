import os
import tempfile
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from io import BytesIO
from datetime import datetime
from database import get_db
from auth_utils import get_current_user, UserContext

import httpx

try:
    from fpdf import FPDF
except ImportError:
    FPDF = None

router = APIRouter(prefix="/api/contracts", tags=["Contracts"])


async def _download_image_to_temp(url: str, suffix: str = ".jpg") -> str | None:
    if not url or not url.startswith("http"):
        return None
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            tmp_dir = Path(tempfile.gettempdir()) / "paljale_contracts"
            tmp_dir.mkdir(parents=True, exist_ok=True)
            tmp_path = tmp_dir / f"{os.urandom(8).hex()}{suffix}"
            tmp_path.write_bytes(response.content)
            return str(tmp_path)
    except Exception:
        return None


class ContractPDF(FPDF):
    def header(self):
        self.set_font("Arial", "B", 16)
        self.set_text_color(243, 120, 32)
        self.cell(0, 10, "PAL JALE - CONTRATO DE RENTA", 0, 1, "C")
        self.ln(2)
        self.set_font("Arial", "", 10)
        self.set_text_color(80, 80, 80)
        self.cell(0, 6, "Marketplace 360° de Construcción", 0, 1, "C")
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("Arial", "I", 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f"Página {self.page_no()} | Documento generado el {datetime.utcnow().strftime('%d/%m/%Y %H:%M')}", 0, 0, "C")


@router.get("/{order_id}/pdf")
async def generate_contract_pdf(order_id: str, user: UserContext = Depends(get_current_user)):
    if FPDF is None:
        raise HTTPException(status_code=500, detail="Librería fpdf no instalada. Ejecuta: pip install fpdf2")
    db = await get_db()
    order = await db.orders.find_one({"id": order_id})
    if not order or (order["user_id"] != user.id and order["provider_id"] != user.id):
        raise HTTPException(status_code=403, detail="No autorizado")
    if order.get("transaction_type") != "renta":
        raise HTTPException(status_code=400, detail="Solo aplica para rentas")
    provider = await db.users.find_one({"id": order["provider_id"]})
    client = await db.users.find_one({"id": order["user_id"]})
    pdf = ContractPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_font("Arial", "B", 12)
    pdf.set_text_color(50, 50, 50)
    pdf.cell(0, 8, "1. PARTES DEL CONTRATO", 0, 1)
    pdf.set_font("Arial", "", 10)
    pdf.cell(0, 6, f"ARRENDADOR (Proveedor): {provider.get('full_name', 'N/A')}", 0, 1)
    pdf.cell(0, 6, f"Correo: {provider.get('email', 'N/A')}", 0, 1)
    pdf.cell(0, 6, f"Teléfono: {provider.get('phone', 'N/A')}", 0, 1)
    pdf.ln(3)
    pdf.cell(0, 6, f"ARRENDATARIO (Cliente): {client.get('full_name', 'N/A')}", 0, 1)
    pdf.cell(0, 6, f"Correo: {client.get('email', 'N/A')}", 0, 1)
    pdf.cell(0, 6, f"Teléfono: {client.get('phone', 'N/A')}", 0, 1)
    pdf.ln(5)
    pdf.set_font("Arial", "B", 12)
    pdf.cell(0, 8, "2. DESCRIPCIÓN DEL EQUIPO", 0, 1)
    pdf.set_font("Arial", "", 10)
    pdf.cell(0, 6, f"Producto: {order.get('product_title', 'N/A')}", 0, 1)
    pdf.cell(0, 6, f"ID de Orden: {order_id}", 0, 1)
    pdf.cell(0, 6, f"Fecha de inicio: {order.get('start_date', 'N/A')}", 0, 1)
    pdf.cell(0, 6, f"Fecha de fin: {order.get('end_date', 'N/A')}", 0, 1)
    pdf.cell(0, 6, f"Dirección de entrega: {order.get('delivery_address', 'N/A')}", 0, 1)
    pdf.cell(0, 6, f"Método: {order.get('delivery_method', 'N/A').upper()}", 0, 1)
    pdf.ln(5)
    pdf.set_font("Arial", "B", 12)
    pdf.cell(0, 8, "3. MONTO Y CONDICIONES DE PAGO", 0, 1)
    pdf.set_font("Arial", "", 10)
    pdf.cell(95, 7, "Concepto", 1, 0, "C")
    pdf.cell(95, 7, "Monto (MXN)", 1, 1, "C")
    days = len(order.get("booked_dates", [])) or 1
    pdf.cell(95, 7, f"Subtotal renta ({days} días)", 1, 0)
    pdf.cell(95, 7, f"$ {order.get('subtotal_mxn', 0):,.2f}", 1, 1, "R")
    pdf.cell(95, 7, "Depósito de garantía", 1, 0)
    pdf.cell(95, 7, f"$ {order.get('deposit_mxn', 0):,.2f}", 1, 1, "R")
    if order.get("insurance_enabled"):
        pdf.cell(95, 7, f"Seguro opcional ({order.get('insurance_percent', 0)}%)", 1, 0)
        pdf.cell(95, 7, f"$ {order.get('insurance_fee_mxn', 0):,.2f}", 1, 1, "R")
    pdf.cell(95, 7, "Comisión plataforma (5%)", 1, 0)
    pdf.cell(95, 7, f"$ {order.get('platform_fee_mxn', 0):,.2f}", 1, 1, "R")
    pdf.set_font("Arial", "B", 10)
    pdf.set_fill_color(243, 120, 32)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(95, 8, "TOTAL", 1, 0, "C", fill=True)
    pdf.cell(95, 8, f"$ {order.get('total_mxn', 0):,.2f}", 1, 1, "C", fill=True)
    pdf.set_text_color(50, 50, 50)
    pdf.ln(5)
    pdf.set_font("Arial", "B", 12)
    pdf.cell(0, 8, "4. CLÁUSULAS", 0, 1)
    pdf.set_font("Arial", "", 9)
    clauses = [
        "a) El ARRENDATARIO se obliga a devolver el equipo en las mismas condiciones en que fue recibido, salvo desgaste natural por uso correcto.",
        "b) El depósito de garantía será retenido en caso de daños, pérdida o incumplimiento de las condiciones aquí estipuladas.",
        "c) El ARRENDADOR garantiza que el equipo se encuentra en buen estado de funcionamiento al momento de la entrega.",
        "d) Cualquier daño debe reportarse dentro de las primeras 24 horas posteriores a la entrega mediante el checklist digital de la plataforma.",
        "e) El seguro opcional cubre únicamente daños por accidentes declarados, no por negligencia o uso indebido.",
        "f) Este contrato se firma electrónicamente y tiene validez legal conforme a la Ley de Firma Electrónica Avanzada."
    ]
    for c in clauses:
        pdf.multi_cell(0, 5, c)
        pdf.ln(1)
    pdf.add_page()
    pdf.set_font("Arial", "B", 12)
    pdf.cell(0, 8, "5. EVIDENCIA DE ENTREGA Y FIRMAS", 0, 1)

    downloaded_paths = []
    dc = order.get("delivery_checklist", {})
    foto_urls = dc.get("foto_urls") or dc.get("fotos_b64") or []
    if foto_urls:
        pdf.set_font("Arial", "B", 10)
        pdf.cell(0, 6, "Fotos de entrega:", 0, 1)
        for idx, photo_url in enumerate(foto_urls[:4]):
            tmp_path = await _download_image_to_temp(photo_url, ".jpg")
            if tmp_path:
                downloaded_paths.append(tmp_path)
                pdf.image(tmp_path, x=10 + (idx % 2) * 95, y=pdf.get_y(), w=85)
                if idx % 2 == 1:
                    pdf.ln(50)
        if len(foto_urls) % 2 == 1:
            pdf.ln(50)

    pdf.set_font("Arial", "B", 10)
    pdf.cell(0, 8, "Firma digital de entrega:", 0, 1)
    signature_url = dc.get("signature_url") or dc.get("signature_b64")
    if signature_url:
        sig_path = await _download_image_to_temp(signature_url, ".png")
        if sig_path:
            downloaded_paths.append(sig_path)
            pdf.image(sig_path, x=10, y=pdf.get_y(), w=80)
            pdf.ln(30)
        else:
            pdf.cell(0, 6, "[Firma no disponible]", 0, 1)
    else:
        pdf.cell(0, 6, "[Sin firma registrada]", 0, 1)
    pdf.cell(0, 6, f"Firmado por ID: {dc.get('signed_by', 'N/A')} el {dc.get('signed_at', 'N/A')}", 0, 1)
    pdf.ln(5)

    rc = order.get("return_checklist", {})
    return_foto_urls = rc.get("foto_urls") or rc.get("fotos_b64") or []
    if return_foto_urls:
        pdf.set_font("Arial", "B", 10)
        pdf.cell(0, 6, "Fotos de devolución:", 0, 1)
        for idx, photo_url in enumerate(return_foto_urls[:4]):
            tmp_path = await _download_image_to_temp(photo_url, ".jpg")
            if tmp_path:
                downloaded_paths.append(tmp_path)
                pdf.image(tmp_path, x=10 + (idx % 2) * 95, y=pdf.get_y(), w=85)
                if idx % 2 == 1:
                    pdf.ln(50)

    pdf.set_font("Arial", "B", 10)
    pdf.cell(0, 8, "Firma digital de devolución:", 0, 1)
    return_signature_url = rc.get("signature_url") or rc.get("signature_b64")
    if return_signature_url:
        sig_path = await _download_image_to_temp(return_signature_url, ".png")
        if sig_path:
            downloaded_paths.append(sig_path)
            pdf.image(sig_path, x=10, y=pdf.get_y(), w=80)
            pdf.ln(30)
        else:
            pdf.cell(0, 6, "[Firma no disponible]", 0, 1)
    else:
        pdf.cell(0, 6, "[Sin firma registrada]", 0, 1)
    pdf.cell(0, 6, f"Firmado por ID: {rc.get('signed_by', 'N/A')} el {rc.get('signed_at', 'N/A')}", 0, 1)

    buffer = BytesIO()
    pdf.output(buffer)
    buffer.seek(0)

    for p in downloaded_paths:
        try:
            Path(p).unlink(missing_ok=True)
        except Exception:
            pass

    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"contract_generated": True, "contract_generated_at": datetime.utcnow().isoformat()}},
    )
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=contrato_paljale_{order_id}.pdf"},
    )
