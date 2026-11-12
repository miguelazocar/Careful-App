import { attachmentMime, attachmentName, documentFileName, documentVisual, isImagePath, safeFileName } from '../attachments';

describe('attachments', () => {
  it('tells photos from documents by extension', () => {
    expect(isImagePath('photos/abc.jpg')).toBe(true);
    expect(isImagePath('photos/abc--Foto del motor.PNG')).toBe(true);
    expect(isImagePath('photos/abc--Factura.pdf')).toBe(false);
    expect(isImagePath('photos/abc--Garantía.docx')).toBe(false);
  });

  it('recovers the original name and mime type of a document', () => {
    expect(attachmentName('photos/k3j2--Factura service 12-11.pdf')).toBe('Factura service 12-11.pdf');
    expect(attachmentName('photos/k3j2.jpg')).toBe('k3j2.jpg');
    expect(attachmentMime('photos/k3j2--Factura.pdf')).toBe('application/pdf');
    expect(attachmentMime('photos/k3j2--Garantía.DOCX')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(attachmentMime('photos/k3j2--notas')).toBe('application/octet-stream');
  });

  it('picks an icon per document type', () => {
    expect(documentVisual('a--x.pdf')).toMatchObject({ icon: 'file-pdf-box', label: 'PDF' });
    expect(documentVisual('a--x.doc').icon).toBe('file-word-box');
    expect(documentVisual('a--x.xlsx').icon).toBe('file-excel-box');
    expect(documentVisual('a--x').label).toBe('Archivo');
  });

  it('makes file names safe to store and keeps the extension of long ones', () => {
    expect(safeFileName('Factura: taller/centro?.pdf')).toBe('Factura_ taller_centro_.pdf');
    const long = safeFileName(`${'x'.repeat(120)}.pdf`);
    expect(long.length).toBeLessThanOrEqual(80);
    expect(long.endsWith('.pdf')).toBe(true);
    expect(safeFileName('   ')).toBe('archivo');
  });

  it('adds the extension of the mime type when the picked name has none', () => {
    expect(documentFileName('Factura', 'application/pdf')).toBe('Factura.pdf');
    expect(documentFileName('Garantía.docx', 'application/pdf')).toBe('Garantía.docx');
    expect(documentFileName('content/abc/Notas', 'application/x-unknown')).toBe('Notas');
  });
});
