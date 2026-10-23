const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:1400}});
await p.goto('file://'+process.cwd()+'/pdfbuild_full.html');await p.waitForTimeout(1500);
await p.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);});
await p.emulateMedia({media:'print',colorScheme:'light'});
await p.pdf({path:'full_test.pdf',format:'Letter',printBackground:true,scale:0.85,margin:{top:'0.7in',bottom:'0.7in',left:'0.7in',right:'0.7in'},displayHeaderFooter:true,
 headerTemplate:'<div style="font-family:Helvetica,Arial;font-size:7.5px;color:#56636e;width:100%;padding:0 0.7in;display:flex;justify-content:space-between"><span>NextChapter Displacement Report</span><span>September 2026 · Version 1.4</span></div>',
 footerTemplate:'<div style="font-family:Helvetica,Arial;font-size:7.5px;color:#56636e;width:100%;padding:0 0.7in;display:flex;justify-content:space-between"><span>launchyournextchapter.com/reports</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>'});
await b.close();})();
