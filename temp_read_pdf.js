const fs = require('fs');
const pdfParse = require('pdf-parse/lib/pdf-parse');
const name = 'קו טלפוני למערכת הזמנות עטיפות.docxאפיון 3.pdf';
const dataBuffer = fs.readFileSync(name);
pdfParse(dataBuffer).then(function(data) {
  console.log('num pages', data.numpages);
  console.log('text snippet');
  console.log(data.text.slice(0, 5000));
}).catch(err => {
  console.error(err);
  process.exit(1);
});
