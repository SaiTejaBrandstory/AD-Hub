"""Render a dataset dashboard to PDF (matches scheduled-reports look)."""
import io
from datetime import datetime, timezone
from reportlab.lib.pagesizes import LETTER
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.units import inch
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.linecharts import HorizontalLineChart
from reportlab.graphics.charts.barcharts import VerticalBarChart


INK = colors.HexColor("#0A0A0B")
INK_400 = colors.HexColor("#616165")
INK_300 = colors.HexColor("#A0A0A5")
BORDER = colors.HexColor("#E2E2E6")
SUBTLE = colors.HexColor("#F7F7F8")
INFO = colors.HexColor("#0090FF")
SUCCESS = colors.HexColor("#30A46C")
DANGER = colors.HexColor("#E5484D")
WARNING = colors.HexColor("#F5D90A")


def _label(t, s=7):
    return Paragraph(
        f'<font name="Helvetica" size="{s}" color="#A0A0A5">{t.upper()}</font>',
        ParagraphStyle("k", fontName="Helvetica", fontSize=s, spaceAfter=2),
    )


def _value(t, s=14):
    return Paragraph(
        f'<font name="Helvetica-Bold" size="{s}" color="#0A0A0B">{t}</font>',
        ParagraphStyle("v", fontName="Helvetica-Bold", fontSize=s, leading=s + 4),
    )


def _kpi(label, value):
    return [_label(label), Spacer(1, 2), _value(value)]


def render_dataset_pdf(workspace_name, dataset_name, platform, ingest_date,
                       digest, dashboard) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=LETTER,
                            leftMargin=0.7 * inch, rightMargin=0.7 * inch,
                            topMargin=0.7 * inch, bottomMargin=0.7 * inch)
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontName="Helvetica-Bold",
                        fontSize=22, leading=26, spaceAfter=4, textColor=INK)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontName="Helvetica-Bold",
                        fontSize=12, leading=15, spaceBefore=18, spaceAfter=8, textColor=INK)
    small = ParagraphStyle("sm", parent=styles["BodyText"], fontName="Helvetica",
                           fontSize=9, leading=12, textColor=INK_400)
    body = ParagraphStyle("body", parent=styles["BodyText"], fontName="Helvetica",
                          fontSize=9.5, leading=13, textColor=INK)

    story = []
    # Header
    story.append(Paragraph(workspace_name, h1))
    story.append(Paragraph(
        f"{dataset_name}  ·  {platform}  ·  ingested {ingest_date}",
        small,
    ))

    # Headline
    if dashboard.get("headline"):
        story.append(Spacer(1, 16))
        story.append(Paragraph(
            f'<font color="#0090FF" size="9"><b>AI HEADLINE</b></font>',
            small,
        ))
        story.append(Paragraph(
            f'<font name="Helvetica-Bold" size="13" color="#0A0A0B">{dashboard["headline"]}</font>',
            body,
        ))
        if dashboard.get("score") is not None:
            story.append(Paragraph(
                f'<font name="Helvetica" size="9" color="#616165">Overall score: '
                f'<font color="#0A0A0B"><b>{dashboard["score"]}/100</b></font></font>',
                small,
            ))

    # KPI grid
    kpis = digest.get("kpis", {})
    if kpis:
        story.append(Spacer(1, 16))
        cells = []
        if "spend" in kpis: cells.append(_kpi("SPEND", f"${kpis['spend']:,.0f}"))
        if "revenue" in kpis: cells.append(_kpi("REVENUE", f"${kpis['revenue']:,.0f}"))
        if "roas" in kpis: cells.append(_kpi("ROAS", f"{kpis['roas']:.2f}×"))
        if "conversions" in kpis: cells.append(_kpi("CONVERSIONS", f"{kpis['conversions']:,}"))
        if "impressions" in kpis: cells.append(_kpi("IMPRESSIONS", f"{kpis['impressions']:,}"))
        if "clicks" in kpis: cells.append(_kpi("CLICKS", f"{kpis['clicks']:,}"))
        if "ctr" in kpis: cells.append(_kpi("CTR", f"{kpis['ctr']}%"))
        if "cpc" in kpis: cells.append(_kpi("CPC", f"${kpis['cpc']}"))

        # Pad to multiple of 4
        while len(cells) % 4 != 0:
            cells.append([Paragraph("", small)])
        rows = [cells[i:i + 4] for i in range(0, len(cells), 4)]
        kpi_tbl = Table(rows, colWidths=[1.65 * inch] * 4,
                        rowHeights=[0.7 * inch] * len(rows))
        kpi_tbl.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER),
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(kpi_tbl)

    # Trend chart (if timeseries)
    if digest.get("timeseries"):
        story.append(Paragraph("Performance trend", h2))
        story.append(_build_trend_chart(digest["timeseries"]))

    # Top campaigns
    if digest.get("top_campaigns"):
        story.append(Paragraph("Top campaigns by spend", h2))
        rows = [["Campaign", "Spend", "Revenue", "ROAS", "Conv."]]
        for c in digest["top_campaigns"][:8]:
            rows.append([
                (c["campaign"][:42] + "…") if len(c["campaign"]) > 43 else c["campaign"],
                f"${c.get('spend', 0):,.0f}",
                f"${c.get('revenue', 0):,.0f}" if "revenue" in c else "—",
                f"{c.get('roas', 0):.2f}×" if "roas" in c else "—",
                str(c.get("conversions", "—")),
            ])
        tbl = Table(rows, colWidths=[2.6 * inch, 1.0 * inch, 1.0 * inch, 0.8 * inch, 0.8 * inch])
        tbl.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("BACKGROUND", (0, 0), (-1, 0), SUBTLE),
            ("TEXTCOLOR", (0, 0), (-1, 0), INK_400),
            ("LINEBELOW", (0, 0), (-1, 0), 0.5, BORDER),
            ("LINEBELOW", (0, 1), (-1, -1), 0.25, colors.HexColor("#EBEBEC")),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(tbl)

    # AI Insights
    insights = dashboard.get("insights") or []
    if insights:
        story.append(PageBreak())
        story.append(Paragraph("AI insights & recommendations", h1))
        story.append(Spacer(1, 10))
        for i, ins in enumerate(insights, 1):
            sev = (ins.get("severity") or "info").lower()
            color = {"critical": DANGER, "warning": WARNING, "info": INFO}.get(sev, INFO)
            color_hex = f"#{color.hexval()[2:]}"
            rows = [[
                Paragraph(
                    f'<font color="{color_hex}" size="8"><b>{sev.upper()}</b></font>  '
                    f'<font name="Helvetica-Bold" size="10.5" color="#0A0A0B">{ins.get("title","")}</font>',
                    body,
                ),
            ], [
                Paragraph(f'<font size="9" color="#616165">{ins.get("detail","")}</font>', body),
            ], [
                Paragraph(
                    f'<font size="9" color="#0A0A0B"><b>→ Action:</b> {ins.get("action","")}</font>',
                    body,
                ),
            ]]
            t = Table(rows, colWidths=[6.5 * inch])
            t.setStyle(TableStyle([
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (0, 0), 10),
                ("BOTTOMPADDING", (0, -1), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, 1), 4),
                ("TOPPADDING", (0, 1), (-1, -1), 0),
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ]))
            story.append(t)
            story.append(Spacer(1, 8))

    story.append(Spacer(1, 20))
    story.append(Paragraph(
        f"Generated {datetime.now(timezone.utc).strftime('%b %d, %Y · %H:%M UTC')} by AdHub · powered by Claude Sonnet 4.5",
        small,
    ))

    doc.build(story)
    return buf.getvalue()


def _build_trend_chart(ts: list) -> Drawing:
    """Simple line chart of spend over time using ReportLab's drawing kit."""
    drawing = Drawing(420, 160)
    if not ts:
        return drawing
    spends = [t.get("spend", 0) for t in ts]
    revs = [t.get("revenue", 0) for t in ts]
    has_rev = any(r > 0 for r in revs)
    chart = HorizontalLineChart()
    chart.x = 30
    chart.y = 20
    chart.height = 120
    chart.width = 370
    chart.data = [spends, revs] if has_rev else [spends]
    chart.lines[0].strokeColor = INK
    chart.lines[0].strokeWidth = 1.5
    if has_rev:
        chart.lines[1].strokeColor = SUCCESS
        chart.lines[1].strokeWidth = 1.5
    chart.categoryAxis.visibleTicks = False
    chart.categoryAxis.labels.fontSize = 6
    chart.categoryAxis.labels.fillColor = INK_300
    # Only show first, middle, last labels to avoid overlap
    cats = [t.get("date", "")[5:] for t in ts]
    if len(cats) > 8:
        keep = {0, len(cats) // 2, len(cats) - 1}
        cats = [c if i in keep else "" for i, c in enumerate(cats)]
    chart.categoryAxis.categoryNames = cats
    chart.valueAxis.labels.fontSize = 7
    chart.valueAxis.labels.fillColor = INK_400
    chart.valueAxis.strokeColor = BORDER
    chart.categoryAxis.strokeColor = BORDER
    drawing.add(chart)
    return drawing
