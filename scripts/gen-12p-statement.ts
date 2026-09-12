import { PDFDocument, StandardFonts } from "pdf-lib";
import fs from "fs";

async function main() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let balance = 5000;
  for (let p = 1; p <= 12; p++) {
    const page = doc.addPage([612, 792]);
    page.drawText("FIRST MERIDIAN BANK — STATEMENT", { x: 40, y: 750, size: 14, font: bold });
    page.drawText(`Page ${p} of 12  |  Account XXXX-7702  |  Marker: PAGE${String(p).padStart(2, "0")}`, { x: 40, y: 730, size: 9, font });
    let y = 700;
    page.drawText("Date", { x: 40, y, size: 9, font: bold });
    page.drawText("Description", { x: 110, y, size: 9, font: bold });
    page.drawText("Amount", { x: 420, y, size: 9, font: bold });
    page.drawText("Balance", { x: 500, y, size: 9, font: bold });
    y -= 16;
    for (let t = 1; t <= 18; t++) {
      const amt = ((p * 13 + t * 7) % 90) + 10.25;
      const isDep = (p + t) % 4 === 0;
      balance = +(balance + (isDep ? amt : -amt)).toFixed(2);
      const day = String(((p + t) % 27) + 1).padStart(2, "0");
      page.drawText(`09/${day}/2026`, { x: 40, y, size: 8, font });
      page.drawText(`PAGE${String(p).padStart(2, "0")}-TX${String(t).padStart(2, "0")} ${isDep ? "ACH Deposit" : "Card Purchase"} Vendor ${p}${t}`, { x: 110, y, size: 8, font });
      page.drawText((isDep ? "" : "-") + amt.toFixed(2), { x: 420, y, size: 8, font });
      page.drawText(balance.toFixed(2), { x: 500, y, size: 8, font });
      y -= 14;
    }
  }
  fs.writeFileSync(process.argv[2]!, await doc.save());
  console.log("wrote", process.argv[2], "pages: 12, tx/page: 18");
}
main();
