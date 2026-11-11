/** Browser-level smoke test for the private visual CMS layout.
 *  All endpoints are mocked; no Cognito access and no content is published.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import blankSite from '../src/cms/defaults.json' with {type:'json'};

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1600,height:900}});
const json=data=>({status:200,contentType:'application/json',body:JSON.stringify(data)});
let persistedDraft=structuredClone(blankSite),revision=0,saves=0;

try{
  await page.route('**/admin/api/session',r=>r.fulfill(json({
    authenticated:true,email:'smoke@example.invalid',csrf:'mock-csrf',
    features:{cms:'ready',jobs:'ready',tasks:'planned'}
  })));
  await page.route('**/admin/api/cms',r=>{
    const method=r.request().method();
    if(method==='PUT'){
      const {document,revision:expected}=r.request().postDataJSON();
      assert.equal(expected,revision,'Save must use latest revision');
      persistedDraft=structuredClone(document);
      revision+=1;saves+=1;
    }else assert.equal(method,'GET','CMS visual test must never publish');
    return r.fulfill(json({draft:persistedDraft,revision,publishedRevision:0}));
  });
  await page.route('**/admin/api/media',r=>r.fulfill(json({images:[]})));
  await page.goto('http://127.0.0.1:5173/admin/cms',{waitUntil:'networkidle'});
  await page.locator('.visual-page-frame').waitFor();
  const stage=page.locator('.visual-cms-stage');
  const original=await stage.boundingBox();
  assert(original?.width>850,'CMS stage should have meaningful width with workspace sidebar removed');
  assert.equal(await page.locator('.admin-sidebar').isVisible(),false,'Workspace sidebar should be collapsed in CMS mode');
  assert.equal(await page.locator('.visual-workspace-menu summary').count(),1);

  // All four responsive device presets must change the _actual_ layout width.
  const examples=[['Desktop',1440],['Laptop',1280],['Tablet',768],['Phone',390]];
  for(const [name,width] of examples){
    const button=page.locator('.visual-viewports button').filter({hasText:name});
    await button.click();
    assert.equal(await button.getAttribute('aria-pressed'),'true',name+' should be selected');
    assert.equal(await page.locator('input[aria-label="Preview width pixels"]').inputValue(),String(width));
    const expected=width<=540?'mobile':width<=900?'tablet':'desktop';
    assert.equal(await page.locator('.visual-page-frame').getAttribute('class'),'visual-page-frame '+expected);
    const rect=await page.locator('.visual-page-frame').boundingBox();
    const canvas=await page.locator('.visual-cms-canvas').boundingBox();
    assert(rect&&canvas);
    assert(Math.abs((rect.x+rect.width/2)-(canvas.x+canvas.width/2))<40,
       name+' preview not centred in canvas');
  }

  // Custom sizes, 100% inspection, and collapsible editor rails.
  const custom=page.locator('input[aria-label="Preview width pixels"]');
  await custom.fill('520');
  assert.equal(await custom.inputValue(),'520');
  assert.equal(await page.locator('.visual-page-frame').getAttribute('class'),'visual-page-frame mobile');
  await page.locator('.visual-viewports button').filter({hasText:'Desktop'}).click();
  await page.getByRole('button',{name:'Fit preview'}).click();
  assert.equal(await page.getByRole('button',{name:'100% size'}).getAttribute('aria-pressed'),'false');
  await page.getByRole('button',{name:'100% size'}).click();

  await page.locator('.visual-desktop-rail').click();
  await page.waitForTimeout(100);
  const expanded=await stage.boundingBox();
  assert(expanded&&expanded.width>original.width+100,'Hiding sections should expand the preview stage');
  await page.locator('.visual-desktop-rail').click();
  const restored=await stage.boundingBox();
  assert(restored&&restored.width<expanded.width-100,'Sections should reopen');

  // A starter picker belongs ONLY in the sidebar, never on top of the website.
  assert.equal(await page.locator('.visual-template-chooser').count(),0);
  assert.equal(await page.locator('.visual-inspector-body').getByText('Choose a starting point').count(),0);
  assert.equal(await page.locator('.visual-sidebar-templates').count(),1);
  assert.equal(await page.locator('.visual-sidebar-templates').evaluate(el=>el.open),false);
  await page.locator('.visual-sidebar-templates summary').click();
  await page.locator('.visual-sidebar-template-options button').filter({hasText:'Professional portfolio'}).click();
  assert(await page.locator('.visual-preview-section').count()>=6,'Starter blocks did not render');
  await page.locator('.visual-preview-section').first().click();
  const field=page.getByLabel('Heading',{exact:true});
  await field.fill('A properly live preview');
  assert((await page.locator('.portfolio-hero h1').innerText()).includes('A properly live preview'));

  // Save, reload and publish-style rehydration must not bring back a starter prompt.
  await Promise.all([
    page.waitForResponse(response=>response.url().endsWith('/admin/api/cms')
      && response.request().method()==='PUT'),
    page.getByRole('button',{name:'Save draft'}).click()
  ]);
  await page.getByText('Draft saved. The public website is unchanged.').waitFor();
  assert.equal(saves,1,'Draft should reach the backend mock');
  await page.reload({waitUntil:'networkidle'});
  await page.locator('.visual-page-frame').waitFor();
  assert.equal(await page.locator('.visual-template-chooser').count(),0);
  assert.equal(await page.locator('.visual-sidebar-templates').evaluate(el=>el.open),false,
    'Template switcher must stay collapsed after reload');
  assert.equal(await page.locator('.visual-inspector-body').getByText('Choose a starting point').count(),0);
  assert((await page.locator('.portfolio-hero h1').innerText()).includes('A properly live preview'),
    'Saved draft content should survive reload');
  assert.equal(await page.locator('.visual-inspector-head strong').innerText(),'Hero',
    'The first saved section should be selected, not Templates');

  await page.locator('.visual-rail-page select').selectOption('projects');
  await page.locator('.portfolio-detail').waitFor();
  assert.equal(await page.locator('.visual-page-frame').isVisible(),true);

  // The viewport must remain useful on a narrower real browser too.
  await page.setViewportSize({width:700,height:840});
  await page.locator('.visual-mobile-rail').click();
  assert.equal(await page.locator('.visual-cms-rail').isVisible(),true);
  console.log('CMS browser smoke passed: centred canvas, responsive presets, sidebar-only templates, save/reload draft persistence, no recurring prompt, case studies and mobile editing.');
}finally{
  await browser.close();
}
