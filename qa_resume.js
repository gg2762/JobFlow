// QA utility for resume .docx output.
// Converts .docx → .pdf via LibreOffice headless, then runs:
//   1. Page count check (must be 1)
//   2. Skills row line-wrap check (Product/Technical/Languages must each render as 1 visual line)
//   3. XML formatting spot-check (Times New Roman everywhere; canonical margins)
//
// Usage:
//   const { qaResume } = require('./qa_resume.js');
//   const report = qaResume('/path/to/resume.docx');
//   // report = { pass: bool, failures: [...], pdfPath: '...' | null }

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SOFFICE = '/Applications/LibreOffice.app/Contents/MacOS/soffice';

function convertToPdf(docxPath) {
  const outDir = path.dirname(docxPath);
  const pdfPath = path.join(outDir, path.basename(docxPath, '.docx') + '.pdf');
  // LibreOffice headless conversion. --norestore avoids profile lock issues on macOS.
  execSync(
    `"${SOFFICE}" --headless --norestore --convert-to pdf --outdir "${outDir}" "${docxPath}"`,
    { stdio: 'pipe', timeout: 60000 }
  );
  if (!fs.existsSync(pdfPath)) throw new Error(`PDF not produced at ${pdfPath}`);
  return pdfPath;
}

function getPageCount(pdfPath) {
  const out = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
  const m = out.match(/^Pages:\s+(\d+)/m);
  return m ? parseInt(m[1], 10) : -1;
}

function checkSkillsRowsSingleLine(pdfPath) {
  // pdftotext -layout preserves whitespace and indentation, so wraps show as indented continuation lines.
  const text = execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: 'utf8' });
  const lines = text.split('\n');
  const markers = ['Product:', 'Technical:', 'Languages:'];
  const sectionStarts = /^(Summary|Education|Featured Project|Relevant Work Experience|Skills|Work Experience)\b/i;
  const failures = [];
  for (const marker of markers) {
    const idx = lines.findIndex(ln => ln.trim().startsWith(marker));
    if (idx === -1) continue;
    let nextIdx = -1;
    for (let j = idx + 1; j < lines.length; j++) {
      if (lines[j].trim() !== '') { nextIdx = j; break; }
    }
    if (nextIdx === -1) continue;
    const nextLine = lines[nextIdx];
    const nextTrimmed = nextLine.trim();
    const indent = nextLine.length - nextLine.trimStart().length;
    const startsNewSection = markers.some(m => nextTrimmed.startsWith(m)) || sectionStarts.test(nextTrimmed);
    // A continuation line is indented and not a new section/marker.
    if (!startsNewSection && indent > 4) {
      failures.push({ row: marker.replace(':', ''), wrapped_to: nextTrimmed.substring(0, 70) });
    }
  }
  return failures;
}

function checkDocxFormatting(docxPath) {
  const tmp = `/tmp/qa_${process.pid}_${Date.now()}`;
  execSync(`rm -rf "${tmp}" && mkdir -p "${tmp}"`);
  try {
    execSync(`cd "${tmp}" && unzip -q "${docxPath}"`, { stdio: 'pipe' });
    const xml = fs.readFileSync(`${tmp}/word/document.xml`, 'utf8');
    const failures = [];

    // Font check: no Calibri/Arial/Helvetica/etc leakage. All fonts must be Times New Roman.
    const fonts = new Set();
    for (const m of xml.matchAll(/w:ascii="([^"]+)"/g)) fonts.add(m[1]);
    const wrongFonts = [...fonts].filter(f => f !== 'Times New Roman');
    if (wrongFonts.length) failures.push({ check: 'font', expected: 'Times New Roman', found: wrongFonts });

    // Margin check: top=720, right=900, bottom=720, left=900.
    const pgMar = xml.match(/<w:pgMar\s+([^/]+)\/>/);
    if (pgMar) {
      const expected = { top: '720', right: '900', bottom: '720', left: '900' };
      for (const k of Object.keys(expected)) {
        const mm = pgMar[1].match(new RegExp(`w:${k}="(\\d+)"`));
        const got = mm ? mm[1] : null;
        if (got !== expected[k]) failures.push({ check: 'margin', side: k, expected: expected[k], actual: got });
      }
    } else {
      failures.push({ check: 'margin', error: 'no pgMar element found' });
    }

    // Tab-stop check: header + role/edu lines should use position 10440.
    const wrongTabs = [...xml.matchAll(/<w:tab\s+([^/]*)\/>/g)]
      .map(m => m[1])
      .filter(attrs => /w:val="right"/.test(attrs) && !/w:pos="10440"/.test(attrs));
    if (wrongTabs.length) failures.push({ check: 'tab_stop', expected_pos: 10440, wrong_count: wrongTabs.length });

    return failures;
  } finally {
    execSync(`rm -rf "${tmp}"`);
  }
}

function qaResume(docxPath) {
  const report = { pass: true, failures: [], pdfPath: null };

  // 1. PDF conversion
  let pdfPath;
  try {
    pdfPath = convertToPdf(docxPath);
    report.pdfPath = pdfPath;
  } catch (e) {
    report.pass = false;
    report.failures.push({ check: 'pdf_conversion', error: e.message.split('\n')[0] });
    return report;
  }

  // 2. Page count
  try {
    const pages = getPageCount(pdfPath);
    if (pages !== 1) {
      report.pass = false;
      report.failures.push({ check: 'page_count', expected: 1, actual: pages });
    }
  } catch (e) {
    report.failures.push({ check: 'page_count', error: e.message.split('\n')[0] });
    report.pass = false;
  }

  // 3. Skills row line-wrap
  try {
    const wraps = checkSkillsRowsSingleLine(pdfPath);
    if (wraps.length) {
      report.pass = false;
      wraps.forEach(w => report.failures.push({ check: 'skills_row_wrap', ...w }));
    }
  } catch (e) {
    report.failures.push({ check: 'skills_row_wrap', error: e.message.split('\n')[0] });
  }

  // 4. XML formatting spot-check
  try {
    const fmtFailures = checkDocxFormatting(docxPath);
    if (fmtFailures.length) {
      report.pass = false;
      fmtFailures.forEach(f => report.failures.push(f));
    }
  } catch (e) {
    report.failures.push({ check: 'xml_format', error: e.message.split('\n')[0] });
  }

  return report;
}

function printReport(report, docxPath) {
  const name = path.basename(docxPath);
  if (report.pass) {
    console.log(`\n✅ QA PASS: ${name}`);
    if (report.pdfPath) console.log(`   PDF: ${report.pdfPath}`);
  } else {
    console.log(`\n❌ QA FAIL: ${name}`);
    report.failures.forEach(f => {
      console.log(`   - ${f.check}: ${JSON.stringify({ ...f, check: undefined }).replace(/^\{|\}$/g, '')}`);
    });
    if (report.pdfPath) console.log(`   PDF (for inspection): ${report.pdfPath}`);
  }
}

module.exports = { qaResume, printReport };

// CLI usage: node qa_resume.js <docx_path>
if (require.main === module) {
  const docxPath = process.argv[2];
  if (!docxPath) { console.error('Usage: node qa_resume.js <docx_path>'); process.exit(1); }
  const report = qaResume(docxPath);
  printReport(report, docxPath);
  process.exit(report.pass ? 0 : 1);
}
