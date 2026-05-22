"""
frontend_pdf_generator.py — pixel-locked GreytHR payslip clone
Reference: BlackRoth payslip image (Feb 2026)

Every value below is derived from direct measurement of the reference image.
Do not change without re-measuring against the reference.
"""
import os
import base64
from decimal import Decimal

from django.conf import settings

from .models import Payslip


def _get_sync_playwright():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise ImportError(
            "Playwright is required for payslip PDF generation. "
            "Install it with 'pip install playwright' and run 'playwright install chromium'."
        ) from exc
    return sync_playwright

LOGO_PATH = r"C:/Users/ajays/RothDesk/logo1.png"


# ─── pure helpers ─────────────────────────────────────────────────────────────

def _load_logo_b64() -> str:
    for p in [
        LOGO_PATH,
        os.path.join(settings.BASE_DIR, '..', '..', 'logo1.png'),
        os.path.join(settings.BASE_DIR, '..', 'frontend', 'public', 'logo1.png'),
    ]:
        try:
            if os.path.exists(p):
                with open(p, 'rb') as f:
                    return base64.b64encode(f.read()).decode()
        except Exception:
            pass
    return ''


def _fmt(v) -> str:
    try:
        return str(int(round(float(v))))
    except Exception:
        return '0'


def _words(num) -> str:
    try:
        num = int(round(float(num)))
    except Exception:
        return 'Zero'
    if num == 0:
        return 'Zero'
    ones = [
        '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight',
        'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
        'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
    ]
    tens_w = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty',
              'Sixty', 'Seventy', 'Eighty', 'Ninety']

    def _h(n):
        if n < 20:
            return ones[n]
        return tens_w[n // 10] + (' ' + ones[n % 10] if ones[n % 10] else '')

    def _t(n):
        if n < 100:
            return _h(n)
        return ones[n // 100] + ' Hundred' + (' And ' + _h(n % 100) if n % 100 else '')

    parts = []
    c  = num // 10_000_000; num %= 10_000_000
    l  = num // 100_000;    num %= 100_000
    th = num // 1_000;      num %= 1_000
    if c:   parts.append(_t(c)  + ' Crore')
    if l:   parts.append(_t(l)  + ' Lakh')
    if th:  parts.append(_t(th) + ' Thousand')
    if num: parts.append(_t(num))
    return ' '.join(parts)


# ─── CSS ──────────────────────────────────────────────────────────────────────
# Every value is locked to the reference. Comments explain the measurement.
_CSS = """
/* ── reset ── */
*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* ── page ──
   Body padding creates the white margin between page edge and outer border.
   Reference shows ~10–12px gap on all sides.
*/
body {
  font-family: "Times New Roman", Times, serif;
  font-size: 12px;
  line-height: 1.0;
  color: #000;
  background: #fff;
  padding: 12px 14px;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* ── outer wrapper ──
   Single 1px black border wrapping the entire payslip.
   No border-radius, no shadow.
*/
.wrap {
  border: 1px solid #000;
  width: 100%;
  display: block;
}

/* ════════════════════════════════════════════════════════
   HEADER
   Technique: the container is position:relative with
   display:flex + justify-content:center so the company
   block is centered on the FULL container width.
   The logo is position:absolute left so it does NOT
   participate in flex layout and cannot shift the center.
   The hdr-center gets symmetric horizontal padding equal
   to the logo width (≈115px) so text never overlaps logo.
════════════════════════════════════════════════════════ */
.hdr {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid #000;
  /* vertical padding measured from reference: ~9px top, ~9px bottom */
  padding: 9px 12px;
  min-height: 70px;
}

/* Logo: absolutely positioned, vertically centered */
.hdr-logo {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  line-height: 0;
}
.hdr-logo img {
  /* Reference logo height ≈ 52px at A4 scale */
  height: 52px;
  width: auto;
  display: block;
  object-fit: contain;
  object-position: left center;
}
.hdr-logo-ph {
  /* placeholder when logo file missing */
  display: inline-block;
  height: 52px;
  width: 110px;
  background: #000;
}

/* Company block: centered on full width.
   padding-left = padding-right = logo_width + logo_left_offset + gap
   logo is ~110px wide, left:10px → total left reserve ≈ 125px.
   Use equal padding both sides so text is mathematically centered.
*/
.hdr-center {
  text-align: center;
  padding-left: 125px;
  padding-right: 125px;
  width: 100%;
}

/* Company name: bold, uppercase, 15px — matches reference heading */
.co-name {
  font-size: 15px;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  line-height: 1.25;
  margin-bottom: 3px;
}

/* Address: 10px, centered, two lines */
.co-addr {
  font-size: 10px;
  line-height: 1.5;
}

/* ════════════════════════════════════════════════════════
   TITLE ROW
   "Payslip for the month of  Feb 2026"
   Bold, centered, 13px, border-bottom 1px.
════════════════════════════════════════════════════════ */
.title {
  text-align: center;
  font-size: 13px;
  font-weight: bold;
  /* reference: ~6px top, ~5px bottom */
  padding: 6px 0 5px;
  border-bottom: 1px solid #000;
  line-height: 1.25;
}

/* ════════════════════════════════════════════════════════
   EMPLOYEE DETAILS TABLE
   Layout: 7 rows × 2 halves separated by a vertical line.
   No cell borders except the single vertical divider.
   Column widths are percentage-based so they scale with
   the outer container (A4 width).

   Left half  = 50% of table
   Right half = 50% of table
   Within each half: label≈22%, colon≈2%, value≈26%
   Divider = 0px (border-left only, no width contribution)
════════════════════════════════════════════════════════ */
.emp-tbl {
  width: 100%;
  border-collapse: collapse;
  border-bottom: 1px solid #000;
  table-layout: fixed;
}
.emp-tbl td {
  padding: 2px 6px;
  font-size: 12px;
  vertical-align: middle;
  border: none;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
}

/* Left half columns */
.e-lbl  { width: 22%; }
.e-col  { width: 2%;  text-align: center; }
.e-val  { width: 26%; white-space: normal; overflow: visible; }

/* Vertical divider — border-left on every row cell */
.e-div  {
  width: 0;
  padding: 0 !important;
  border-left: 1px solid #000 !important;
  border-right: none !important;
  border-top: none !important;
  border-bottom: none !important;
}

/* Right half columns */
.e-lbl2 { width: 22%; }
.e-col2 { width: 2%;  text-align: center; }
.e-val2 { width: 26%; white-space: normal; overflow: visible; }

/* ════════════════════════════════════════════════════════
   SALARY TABLE
   GreytHR style: NO inner horizontal lines.
   Only borders present:
     • Outer table border (1px all sides)
     • Header row bottom border (1px)
     • Total/footer row top border (1px)
   Vertical column separators kept (1px) for readability.
   table-layout:fixed locks column widths regardless of content.
════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════
   SALARY TABLE — GreytHR style
   Borders: outer box + header-bottom + total-top + vertical separators only.
   table-layout:fixed + col widths lock columns regardless of content.
════════════════════════════════════════════════════════ */
.sal-tbl {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  border: 1px solid #000;
}

/* Column widths via nth-child — authoritative, overrides everything */
.sal-tbl col:nth-child(1) { width: 30%; }
.sal-tbl col:nth-child(2) { width: 15%; }
.sal-tbl col:nth-child(3) { width: 12%; }
.sal-tbl col:nth-child(4) { width: 28%; }
.sal-tbl col:nth-child(5) { width: 15%; }

/* All cells: no border, uniform 22px height, compact padding */
.sal-tbl th,
.sal-tbl td {
  border: none;
  padding: 4px 6px;
  font-size: 12px;
  line-height: 1.2;
  vertical-align: middle;
  height: 22px;
  overflow: hidden;
  white-space: nowrap;
}

/* Vertical column separators (left border on every non-first column) */
.sal-tbl th + th,
.sal-tbl td + td {
  border-left: 1px solid #000;
}

/* Header: bold 700, centered, bottom border */
.sal-tbl thead th {
  font-weight: 700;
  text-align: center;
  border-bottom: 1px solid #000;
}

/* Right-align numeric columns 2, 3, 5 (Master / Amount / Ded-Amount) */
.sal-tbl td:nth-child(2),
.sal-tbl td:nth-child(3),
.sal-tbl td:nth-child(5) {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* Left-align label columns 1 and 4 */
.sal-tbl td:nth-child(1),
.sal-tbl td:nth-child(4) {
  text-align: left;
}

/* Class widths kept for <th> (col element drives td; th needs explicit width) */
.c-earn { width: 30%; }
.c-mast { width: 15%; }
.c-amt  { width: 12%; }
.c-ded  { width: 28%; }
.c-damt { width: 15%; }

/* Total row: bold + top border only */
.sal-tbl tfoot td {
  font-weight: bold;
  border-top: 1px solid #000;
}

/* ════════════════════════════════════════════════════════
   NET PAY SECTION
   Reference layout:
     "Net Pay for the Month" [large gap] "32978"  ← same line
     "(Rupees Thirty Two Thousand Nine Hundred Seventy Eight Only)"  ← italic below
   The amount is NOT right-aligned to page edge — it sits
   immediately after the label with a tab-like gap.
════════════════════════════════════════════════════════ */
.net-section {
  padding: 5px 8px 4px 8px;
  border-bottom: 1px solid #000;
}
.net-line {
  display: flex;
  align-items: baseline;
  gap: 0;
}
/* Label: normal weight, 12px, matches body */
.net-lbl {
  font-size: 12px;
  font-weight: normal;
  white-space: nowrap;
  /* reference gap between label and amount ≈ 24px */
  padding-right: 24px;
}
/* Amount: bold, 14px — slightly larger than body */
.net-amt {
  font-size: 14px;
  font-weight: bold;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}
/* Words: italic, 11px, left-aligned, no extra indent */
.net-words {
  font-size: 11px;
  font-style: italic;
  line-height: 1.4;
  margin-top: 2px;
}

/* ════════════════════════════════════════════════════════
   FOOTER
   Centered text, 11px, inside outer border.
   Top border separates it from net pay section.
════════════════════════════════════════════════════════ */
.footer {
  text-align: center;
  font-size: 11px;
  /* reference: ~5px top, ~5px bottom */
  padding: 5px 8px;
  border-top: 1px solid #000;
  line-height: 1.3;
}
"""


# ─── HTML builder ─────────────────────────────────────────────────────────────

def _build_html(payslip: Payslip) -> str:
    emp = payslip.employee

    # logo
    logo_b64 = _load_logo_b64()
    logo_block = (
        f'<div class="hdr-logo">'
        f'<img src="data:image/png;base64,{logo_b64}" alt="Logo">'
        f'</div>'
        if logo_b64
        else '<div class="hdr-logo"><div class="hdr-logo-ph"></div></div>'
    )

    month_year = f"{payslip.pay_period_month} {payslip.pay_period_year}"

    # employee fields
    name        = emp.name or ''
    emp_no      = emp.employee_id or ''
    doj         = emp.doj.strftime('%d %b %Y') if emp.doj else ''
    designation = emp.position or ''
    department  = emp.department.department_name if emp.department else ''
    location    = emp.location or ''
    pan         = emp.pan or ''
    pf_no       = emp.pf_number or ''
    bank_acc    = emp.bank_account or ''
    work_days   = payslip.work_days
    lop_days    = payslip.lop_days

    bank_name = ''
    try:
        bank_name = emp.bank_detail.bank.name
    except Exception:
        pass

    pf_uan = ''
    try:
        pf_uan = emp.pf_detail.uan or ''
    except Exception:
        pass

    # ── Salary components — dynamic from DB lines, fallback to payslip fields ──
    #
    # Source priority:
    #   1. PayrollRunItemLine records (3C engine path — component-level breakdown)
    #   2. Payslip direct fields (legacy MonthlySalaryData path)
    #
    # earn_rows: list of (label, master_str, amount_str)
    # ded_rows:  list of (label, amount_str)

    earn_rows = []
    ded_rows  = []

    # Try to read from PayrollRunItemLine first
    _lines_loaded = False
    try:
        run_item = getattr(payslip, 'run_item', None)
        if run_item is not None:
            lines = list(
                run_item.lines
                .filter(amount__gt=0)
                .order_by('display_order', 'code')
            )
            if lines:
                _lines_loaded = True
                for line in lines:
                    amt = _fmt(line.amount)
                    if line.component_type == 'EARNING':
                        earn_rows.append((line.name.upper(), amt, amt))
                    elif line.component_type == 'DEDUCTION':
                        ded_rows.append((line.name.upper(), amt))
                    # EMPLOYER_CONTRIBUTION lines are not shown on employee payslip
    except Exception:
        pass

    # Fallback: build from Payslip model fields (always populated)
    if not _lines_loaded:
        basic    = payslip.basic
        hra      = payslip.hra
        special  = payslip.special_allowance
        da       = payslip.da
        conv     = payslip.conveyance
        medical  = payslip.medical
        pf_emp   = payslip.pf_employee
        prof_tax = payslip.professional_tax
        tds      = getattr(payslip, 'tds_amount', Decimal('0'))
        other_d  = payslip.other_deductions
        sal_adv  = payslip.salary_advance

        # Earnings — BASIC always shown; rest only if > 0
        earn_rows = [('BASIC', _fmt(basic), _fmt(basic))]
        for lbl, val in [
            ('HRA',               hra),
            ('SPECIAL ALLOWANCE', special),
            ('DA',                da),
            ('CONVEYANCE',        conv),
            ('MEDICAL',           medical),
        ]:
            if float(val) > 0:
                earn_rows.append((lbl, _fmt(val), _fmt(val)))

        # Deductions — only if > 0
        for lbl, val in [
            ('PF',       pf_emp),
            ('PROF TAX', prof_tax),
            ('TDS',      tds),
            ('OTHER',    other_d),
            ('ADVANCE',  sal_adv),
        ]:
            if float(val) > 0:
                ded_rows.append((lbl, _fmt(val)))

    # totals — always from payslip model (authoritative)
    total_earn = payslip.total_earnings
    total_ded  = payslip.total_deductions
    net_pay    = payslip.net_pay
    net_words  = _words(net_pay)

    # pad to equal row count so table is symmetric
    max_rows = max(len(earn_rows), len(ded_rows), 1)
    while len(earn_rows) < max_rows:
        earn_rows.append(('', '', ''))
    while len(ded_rows) < max_rows:
        ded_rows.append(('', ''))

    # build data rows — empty cells use &nbsp; to maintain row height
    data_rows_html = ''
    for i in range(max_rows):
        el, em, ea = earn_rows[i]
        dl, dv     = ded_rows[i]
        # use non-breaking space for empty cells to keep row height uniform
        data_rows_html += (
            f'<tr>'
            f'<td class="c-earn">{el or "&nbsp;"}</td>'
            f'<td class="c-mast">{em}</td>'
            f'<td class="c-amt">{ea}</td>'
            f'<td class="c-ded">{dl or "&nbsp;"}</td>'
            f'<td class="c-damt">{dv}</td>'
            f'</tr>\n'
        )

    # employee detail rows helper — avoids repetition
    def _erow(lbl, val, lbl2, val2):
        return (
            f'<tr>'
            f'<td class="e-lbl">{lbl}</td>'
            f'<td class="e-col">:</td>'
            f'<td class="e-val">{val}</td>'
            f'<td class="e-div"></td>'
            f'<td class="e-lbl2">{lbl2}</td>'
            f'<td class="e-col2">{":" if lbl2 else ""}</td>'
            f'<td class="e-val2">{val2}</td>'
            f'</tr>\n'
        )

    emp_rows = (
        _erow('Name',                 name,       'Employee No',    emp_no)
        + _erow('Joining Date',       doj,        'Bank Name',      bank_name)
        + _erow('Designation',        designation,'Bank Account No', bank_acc)
        + _erow('Department',         department, 'PAN Number',     pan)
        + _erow('Location',           location,   'PF No',          pf_no)
        + _erow('Effective Work Days',work_days,  'PF UAN',         pf_uan)
        + _erow('LOP',                lop_days,   '',               '')
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Payslip {name} {month_year}</title>
<style>{_CSS}</style>
</head>
<body>
<div class="wrap">

  <!-- HEADER -->
  <div class="hdr">
    {logo_block}
    <div class="hdr-center">
      <div class="co-name">BLACKROTH PVT LTD</div>
      <div class="co-addr">
        12A04B, 13th floor, Manjeera Trinity Corporate, Kukatpally Housing Board Colony, Kukatpally, Hyderabad,<br>
        Telangana 500072
      </div>
    </div>
  </div>

  <!-- TITLE -->
  <div class="title">Payslip for the month of &nbsp;{month_year}</div>

  <!-- EMPLOYEE DETAILS -->
  <table class="emp-tbl">
    <colgroup>
      <col class="e-lbl">
      <col class="e-col">
      <col class="e-val">
      <col class="e-div">
      <col class="e-lbl2">
      <col class="e-col2">
      <col class="e-val2">
    </colgroup>
    <tbody>
      {emp_rows}
    </tbody>
  </table>

  <!-- SALARY TABLE -->
  <table class="sal-tbl">
    <colgroup>
      <col class="c-earn">
      <col class="c-mast">
      <col class="c-amt">
      <col class="c-ded">
      <col class="c-damt">
    </colgroup>
    <thead>
      <tr>
        <th class="c-earn">Earnings</th>
        <th class="c-mast">Master</th>
        <th class="c-amt">Amount</th>
        <th class="c-ded">Deductions</th>
        <th class="c-damt">Amount</th>
      </tr>
    </thead>
    <tbody>
      {data_rows_html}
    </tbody>
    <tfoot>
      <tr>
        <td class="c-earn">Total Earnings</td>
        <td class="c-mast">{_fmt(total_earn)}</td>
        <td class="c-amt">{_fmt(total_earn)}</td>
        <td class="c-ded">Total Deductions</td>
        <td class="c-damt">{_fmt(total_ded)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- NET PAY -->
  <div class="net-section">
    <div class="net-line">
      <span class="net-lbl">Net Pay for the Month</span>
      <span class="net-amt">{_fmt(net_pay)}</span>
    </div>
    <div class="net-words">(Rupees {net_words} Only)</div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    This is a system generated payslip and does not require signature.
  </div>

</div>
</body>
</html>"""


# ─── Generator class ──────────────────────────────────────────────────────────

class FrontendPDFGenerator:
    """Generates payslip PDFs via Playwright Chromium → PDF."""

    def __init__(self):
        self.base_path = os.path.join(settings.MEDIA_ROOT, 'payslips')

    def generate_payslip_pdf(self, payslip: Payslip, file_path: str) -> str:
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        html = _build_html(payslip)

        sync_playwright = _get_sync_playwright()
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            page.set_content(html, wait_until='networkidle')
            page.pdf(
                path=file_path,
                format='A4',
                # 0.30in ≈ 21.6px — tight margin so outer border is close to edge
                margin={
                    'top':    '0.30in',
                    'right':  '0.30in',
                    'bottom': '0.30in',
                    'left':   '0.30in',
                },
                print_background=True,
            )
            browser.close()

        return file_path

    def generate_html_preview(self, payslip: Payslip) -> str:
        """Raw HTML for browser preview — open alongside reference at 150% zoom."""
        return _build_html(payslip)
