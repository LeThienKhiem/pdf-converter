"""
Add a password to the statement from gen-locked-statement.ts.

Separate step because pdf-lib cannot write an encrypted PDF — it says so in its
own README. pypdf can, so the generator makes the document and this locks it.

Usage:
    python scripts/encrypt-statement.py [password]
"""
import sys
from pypdf import PdfReader, PdfWriter

PLAIN = "test-statement-plain.pdf"
LOCKED = "test-statement-locked.pdf"
password = sys.argv[1] if len(sys.argv) > 1 else "northbridge2026"

reader = PdfReader(PLAIN)
writer = PdfWriter()
for page in reader.pages:
    writer.add_page(page)
writer.encrypt(password)
with open(LOCKED, "wb") as f:
    writer.write(f)

print(f"{LOCKED} — {len(reader.pages)} pages, password: {password}")
