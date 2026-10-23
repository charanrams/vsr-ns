// Customer tax invoice on A4. Mirrors frontend/src/shop/invoice.ts.
import 'package:flutter/services.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../../core/config.dart';
import '../../core/format.dart';
import '../../core/legal.dart';
import '../../core/models.dart';

/// Opens the system print / share sheet (A4 printer, or save as PDF).
Future<void> printInvoice(OrderSummary o) => Printing.layoutPdf(
      name: 'Invoice ${o.orderNumber}',
      format: _a4,
      onLayout: (_) => buildInvoice(o),
    );

final _a4 = PdfPageFormat.a4.copyWith(
  marginLeft: 14 * PdfPageFormat.mm,
  marginRight: 14 * PdfPageFormat.mm,
  marginTop: 14 * PdfPageFormat.mm,
  marginBottom: 16 * PdfPageFormat.mm,
);

const _brand = PdfColor.fromInt(0xFF064E3B);
const _brandTint = PdfColor.fromInt(0xFFECF5F1);
const _line = PdfColor.fromInt(0xFFE3E3E3);

Future<Uint8List> buildInvoice(OrderSummary o) async {
  // Noto has the ₹ glyph the built-in PDF fonts lack
  final regular = await PdfGoogleFonts.notoSansRegular();
  final bold = await PdfGoogleFonts.notoSansBold();
  final logo = pw.MemoryImage((await rootBundle.load('assets/images/logo_mark.png')).buffer.asUint8List());
  final t = o.totals;
  final count = o.items.fold<int>(0, (s, i) => s + i.quantity);

  const muted = pw.TextStyle(fontSize: 9, color: PdfColors.grey700);
  final b = pw.TextStyle(fontWeight: pw.FontWeight.bold);
  pw.Widget row(String l, String v, {bool strong = false, double size = 10}) => pw.Padding(
        padding: const pw.EdgeInsets.symmetric(vertical: 1.5),
        child: pw.Row(children: [
          pw.Expanded(child: pw.Text(l, style: pw.TextStyle(fontSize: size, fontWeight: strong ? pw.FontWeight.bold : null))),
          pw.Text(v, style: pw.TextStyle(fontSize: size, fontWeight: strong ? pw.FontWeight.bold : null)),
        ]),
      );
  pw.Widget label(String s) => pw.Padding(
        padding: const pw.EdgeInsets.only(bottom: 4),
        child: pw.Text(s.toUpperCase(), style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold, letterSpacing: 1.2, color: PdfColors.grey700)),
      );

  final doc = pw.Document(theme: pw.ThemeData.withFont(base: regular, bold: bold));
  doc.addPage(pw.MultiPage(
    pageFormat: _a4,
    // Long orders continue on the next page; page numbers only when there's more than one
    footer: (c) => c.pagesCount > 1
        ? pw.Align(alignment: pw.Alignment.centerRight, child: pw.Text('Page ${c.pageNumber} of ${c.pagesCount}', style: muted))
        : pw.SizedBox(),
    build: (_) => [
      // Header: business on the left, invoice details on the right
      pw.Container(
        padding: const pw.EdgeInsets.only(bottom: 14),
        decoration: const pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(color: _brand, width: 1.6))),
        child: pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.Expanded(
            child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              pw.Row(children: [
                pw.Image(logo, width: 18 * PdfPageFormat.mm, height: 18 * PdfPageFormat.mm),
                pw.SizedBox(width: 10),
                pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                  pw.Text(legalEntityName.isEmpty ? 'VSR' : legalEntityName, style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold, letterSpacing: 1, color: _brand)),
                  pw.Text('SHOP · EAT · LIVE BETTER', style: const pw.TextStyle(fontSize: 8, letterSpacing: 1.4, color: PdfColors.grey700)),
                ]),
              ]),
              if (legalEntityAddress.isNotEmpty) ...[pw.SizedBox(height: 6), pw.Text(legalEntityAddress, style: muted)],
              if (legalEntityGstin.isNotEmpty) pw.Text('GSTIN: $legalEntityGstin', style: muted),
            ]),
          ),
          pw.SizedBox(width: 24),
          pw.SizedBox(
            width: 70 * PdfPageFormat.mm,
            child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
              pw.Text('TAX INVOICE', style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold, letterSpacing: 2, color: _brand)),
              pw.SizedBox(height: 6),
              row('Invoice no.', o.orderNumber),
              row('Date', dateTime(o.createdAt)),
              row('Payment', o.paymentMethod == 'cod' ? 'Cash on delivery' : o.paymentMethod.toUpperCase()),
            ]),
          ),
        ]),
      ),
      pw.SizedBox(height: 16),
      if (o.address != null) ...[
        label('Bill to'),
        pw.Text(o.address!.recipient, style: b.copyWith(fontSize: 11)),
        pw.Text(o.address!.phone, style: const pw.TextStyle(fontSize: 10)),
        pw.Text(o.address!.oneLine, style: muted),
        pw.SizedBox(height: 16),
      ],
      // Items
      pw.TableHelper.fromTextArray(
        headers: ['#', 'Item', 'Qty', 'Rate', 'Amount'],
        data: [
          for (final (i, it) in o.items.indexed)
            [
              '${i + 1}',
              '${it.name}${(it.variantName ?? it.unit).isNotEmpty ? '\n${it.variantName ?? it.unit}' : ''}',
              '${it.quantity}',
              money(it.unitPrice),
              money(it.lineTotal),
            ],
        ],
        border: const pw.TableBorder(horizontalInside: pw.BorderSide(color: _line, width: 0.6), bottom: pw.BorderSide(color: _line, width: 0.6)),
        headerDecoration: const pw.BoxDecoration(color: _brandTint),
        headerStyle: pw.TextStyle(fontSize: 8.5, fontWeight: pw.FontWeight.bold, letterSpacing: 0.6, color: _brand),
        cellStyle: const pw.TextStyle(fontSize: 10),
        cellPadding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 7),
        columnWidths: const {
          0: pw.FixedColumnWidth(22),
          1: pw.FlexColumnWidth(),
          2: pw.FixedColumnWidth(40),
          3: pw.FixedColumnWidth(72),
          4: pw.FixedColumnWidth(80),
        },
        headerAlignments: const {0: pw.Alignment.centerLeft, 1: pw.Alignment.centerLeft, 2: pw.Alignment.centerRight, 3: pw.Alignment.centerRight, 4: pw.Alignment.centerRight},
        cellAlignments: const {0: pw.Alignment.topLeft, 1: pw.Alignment.topLeft, 2: pw.Alignment.topRight, 3: pw.Alignment.topRight, 4: pw.Alignment.topRight},
      ),
      pw.SizedBox(height: 14),
      // Totals, right-aligned
      pw.Align(
        alignment: pw.Alignment.centerRight,
        child: pw.SizedBox(
          width: 80 * PdfPageFormat.mm,
          child: pw.Column(children: [
            row('Item total ($count item${count == 1 ? '' : 's'})', money(t.itemTotal)),
            if (t.discount > 0) row('Discount${t.couponCode != null ? ' (${t.couponCode})' : ''}', '−${money(t.discount)}'),
            row('Delivery fee', t.deliveryFee == 0 ? 'FREE' : money(t.deliveryFee)),
            row('Packaging fee', money(t.packagingFee)),
            row('GST (included)', money(t.tax)),
            pw.SizedBox(height: 4),
            pw.Container(
              padding: const pw.EdgeInsets.only(top: 5),
              decoration: const pw.BoxDecoration(border: pw.Border(top: pw.BorderSide(width: 1.4))),
              child: row('TOTAL', money(t.grandTotal), strong: true, size: 13),
            ),
          ]),
        ),
      ),
      pw.SizedBox(height: 28),
      pw.Container(
        padding: const pw.EdgeInsets.only(top: 10),
        decoration: const pw.BoxDecoration(border: pw.Border(top: pw.BorderSide(color: _line, width: 0.8))),
        child: pw.Column(children: [
          pw.Text('Thank you for shopping with us!', style: b.copyWith(fontSize: 10.5)),
          pw.Text('Help: ${AppConfig.supportPhone}', style: muted),
          pw.Text('Prices inclusive of all taxes. This is a computer-generated invoice.', style: muted),
        ]),
      ),
    ],
  ));
  return doc.save();
}
