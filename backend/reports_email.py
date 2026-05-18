"""Email reports: render performance PDF + send via Resend."""
import os
import io
import asyncio
import logging
import resend
from datetime import datetime, timezone
from reportlab.lib.pagesizes import LETTER
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.units import inch

logger = logging.getLogger("adhub.reports")


def build_pdf(workspace_name: str, overview: dict, campaigns: list) -> bytes:
    """Render a one-page performance PDF and return bytes."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=LETTER,
                            leftMargin=0.7 * inch, rightMargin=0.7 * inch,
                            topMargin=0.7 * inch, bottomMargin=0.7 * inch)
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontName="Helvetica-Bold",
                        fontSize=22, leading=26, spaceAfter=4, textColor=colors.HexColor("#0A0A0B"))
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontName="Helvetica-Bold",
                        fontSize=11, leading=14, spaceBefore=14, spaceAfter=8,
                        textColor=colors.HexColor("#0A0A0B"))
    small = ParagraphStyle("sm", parent=styles["BodyText"], fontName="Helvetica",
                           fontSize=9, leading=12, textColor=colors.HexColor("#616165"))
    label = ParagraphStyle("lbl", parent=styles["BodyText"], fontName="Helvetica",
                           fontSize=7, leading=9, textColor=colors.HexColor("#A0A0A5"),
                           spaceAfter=2)

    story = []
    story.append(Paragraph(f"{workspace_name} – Performance Report", h1))
    story.append(Paragraph(
        f"Generated {datetime.now(timezone.utc).strftime('%b %d, %Y')} · powered by AdHub",
        small,
    ))

    # KPI cards as a 4-col table
    kpi_rows = [
        [_kpi_cell("SPEND", f"${overview['spend']:,.0f}"),
         _kpi_cell("REVENUE", f"${overview['revenue']:,.0f}"),
         _kpi_cell("ROAS", f"{overview['roas']:.2f}×"),
         _kpi_cell("CONVERSIONS", f"{overview['conversions']:,}")],
        [_kpi_cell("IMPRESSIONS", f"{overview['impressions']:,}"),
         _kpi_cell("CLICKS", f"{overview['clicks']:,}"),
         _kpi_cell("CTR", f"{overview['ctr']}%"),
         _kpi_cell("CPC", f"${overview['cpc']}")],
    ]
    kpi_table = Table(kpi_rows, colWidths=[1.65 * inch] * 4, rowHeights=[0.7 * inch, 0.7 * inch])
    kpi_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E2E6")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E2E6")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(Spacer(1, 18))
    story.append(kpi_table)

    # Campaign table — top 10 by spend
    story.append(Paragraph("Top campaigns by spend", h2))
    top = sorted(campaigns, key=lambda c: c["spend"], reverse=True)[:10]
    rows = [["Campaign", "Platform", "Status", "Spend", "ROAS", "CTR", "Conv."]]
    for c in top:
        rows.append([
            (c["name"][:40] + "…") if len(c["name"]) > 41 else c["name"],
            {"meta_ads": "Meta", "google_ads": "Google", "ga4": "GA4"}.get(c["platform"], c["platform"]),
            c["status"],
            f"${c['spend']:.0f}",
            f"{c['roas']}×",
            f"{c['ctr']}%",
            str(c["conversions"]),
        ])
    tbl = Table(rows, colWidths=[2.2 * inch, 0.6 * inch, 0.6 * inch,
                                  0.7 * inch, 0.6 * inch, 0.6 * inch, 0.6 * inch])
    tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F7F7F8")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#616165")),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.HexColor("#E2E2E6")),
        ("LINEBELOW", (0, 1), (-1, -1), 0.25, colors.HexColor("#EBEBEC")),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(tbl)

    # Platform breakdown
    if overview.get("platforms"):
        story.append(Paragraph("Channel breakdown", h2))
        prows = [["Platform", "Campaigns", "Spend", "Revenue", "Conversions"]]
        labels = {"meta_ads": "Meta Ads", "google_ads": "Google Ads", "ga4": "Google Analytics 4"}
        for k, v in overview["platforms"].items():
            prows.append([labels.get(k, k), v["campaigns"],
                          f"${v['spend']:,.0f}", f"${v['revenue']:,.0f}", v["conversions"]])
        ptbl = Table(prows, colWidths=[2.0 * inch, 1.0 * inch, 1.0 * inch, 1.2 * inch, 1.0 * inch])
        ptbl.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F7F7F8")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#616165")),
            ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.HexColor("#E2E2E6")),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(ptbl)

    story.append(Spacer(1, 18))
    story.append(Paragraph(
        "This report was generated automatically by AdHub. Threshold-based anomalies and AI audit recommendations are available in the live dashboard.",
        small,
    ))

    doc.build(story)
    return buf.getvalue()


def _kpi_cell(label_text, value_text):
    from reportlab.platypus import Paragraph as P
    return [
        P(f'<font name="Helvetica" size="7" color="#A0A0A5">{label_text}</font>',
          ParagraphStyle("k", fontName="Helvetica", fontSize=7)),
        P(f'<font name="Helvetica-Bold" size="14" color="#0A0A0B">{value_text}</font>',
          ParagraphStyle("v", fontName="Helvetica-Bold", fontSize=14, leading=18)),
    ]


async def send_report_email(recipients: list, subject: str, html: str, pdf_bytes: bytes, filename: str):
    """Send an email with PDF attachment via Resend (async, non-blocking)."""
    api_key = os.environ.get("RESEND_API_KEY")
    sender = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
    if not api_key:
        raise RuntimeError("RESEND_API_KEY not configured")

    resend.api_key = api_key
    params = {
        "from": sender,
        "to": recipients,
        "subject": subject,
        "html": html,
        "attachments": [{
            "filename": filename,
            "content": list(pdf_bytes),
        }],
    }
    result = await asyncio.to_thread(resend.Emails.send, params)
    logger.info("Resend email id=%s to=%s", result.get("id"), recipients)
    return result


def build_email_html(workspace_name: str, overview: dict) -> str:
    return f"""
    <table width="100%" cellpadding="0" cellspacing="0" style="font-family:Helvetica,Arial,sans-serif;background:#F7F7F8;padding:32px 0">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #E2E2E6;border-radius:12px;overflow:hidden">
          <tr><td style="padding:28px 28px 8px">
            <div style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#A0A0A5">AdHub · Performance Report</div>
            <h1 style="margin:8px 0 4px;font-size:24px;color:#0A0A0B;letter-spacing:-0.02em">{workspace_name}</h1>
            <div style="font-size:12px;color:#616165">{datetime.now(timezone.utc).strftime('%B %d, %Y')}</div>
          </td></tr>
          <tr><td style="padding:8px 28px">
            <table width="100%" cellpadding="10" cellspacing="0" style="border-collapse:collapse">
              <tr>
                {_html_kpi("SPEND", f"${overview['spend']:,.0f}")}
                {_html_kpi("REVENUE", f"${overview['revenue']:,.0f}")}
              </tr>
              <tr>
                {_html_kpi("ROAS", f"{overview['roas']:.2f}×")}
                {_html_kpi("CONVERSIONS", f"{overview['conversions']:,}")}
              </tr>
            </table>
          </td></tr>
          <tr><td style="padding:16px 28px 28px">
            <p style="font-size:13px;color:#616165;line-height:1.55;margin:0">
              The full report is attached as a PDF. Open AdHub to drill into individual campaigns,
              run an AI audit, or schedule additional report cadences.
            </p>
          </td></tr>
        </table>
        <div style="margin-top:14px;font-size:11px;color:#A0A0A5">© 2026 AdHub</div>
      </td></tr>
    </table>
    """


def _html_kpi(label, value):
    return f"""<td style="border:1px solid #E2E2E6;border-radius:8px;padding:14px;width:50%">
        <div style="font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:#A0A0A5">{label}</div>
        <div style="font-size:22px;font-weight:700;color:#0A0A0B;margin-top:6px">{value}</div>
    </td>"""
