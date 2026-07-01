from pathlib import Path
import sys

name = 'קו טלפוני למערכת הזמנות עטיפות.docxאפיון 3.pdf'
p = Path(name)
print('file', name, 'exists', p.exists(), 'size', p.stat().st_size if p.exists() else None)

try:
    import PyPDF2
    print('PyPDF2 available')
    reader = PyPDF2.PdfReader(name)
    print('pdf pages', len(reader.pages))
    for i, page in enumerate(reader.pages, 1):
        text = page.extract_text() or ''
        print('--- page', i, '---')
        print(text)
        print('--- end page', i, '---\n')
except Exception as e:
    print('pdf error', type(e).__name__, e)
