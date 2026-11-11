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
      assert(!Object.hasOwn(document.theme,'name'),
        'Theme preset display name must never be submitted as site content');
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
  // Content fields follow the rendered hierarchy, not JSON insertion order.
  const contentOrder=await page.locator('.visual-inspector-body .visual-fieldset').first()
    .locator(':scope > label.visual-field').evaluateAll(nodes=>
      nodes.map(node=>node.textContent.trim().split('\n')[0].trim()));
  const orderedIndex=(name)=>contentOrder.findIndex(value=>value.startsWith(name));
  assert(orderedIndex('Headline')>=0&&orderedIndex('Headline')<orderedIndex('Heading'),
    'Small eyebrow should appear ahead of the large heading');
  assert(orderedIndex('Heading')<orderedIndex('Body'),
    'Large heading should appear ahead of the supporting body copy');
  // Pressing Enter in a heading creates a real displayed line break.
  await field.fill('A properly live\npreview');
  const heroHeading=page.locator('.portfolio-hero h1');
  assert((await heroHeading.innerText()).includes('\n'),'Heading line break not visible');
  assert.equal(await heroHeading.evaluate(el=>getComputedStyle(el).whiteSpace),'pre-line');
  await field.fill('A properly live preview');
  assert((await heroHeading.innerText()).includes('A properly live preview'));

  // Section palette only changes this block, not the global site theme.
  await page.getByRole('button',{name:'Block theme Forest'}).click();
  const heroSection=page.locator('.cms-section-hero');
  assert.equal(await heroSection.evaluate(el=>getComputedStyle(el).backgroundColor),
    'rgb(23, 55, 42)');
  const heroThemeText=await heroHeading.evaluate(el=>getComputedStyle(el).color);
  assert.equal(heroThemeText,'rgb(242, 248, 242)');
  await page.getByRole('button',{name:'Block theme Inherit'}).click();
  assert.equal(await heroSection.evaluate(el=>getComputedStyle(el).backgroundColor),
    'rgba(0, 0, 0, 0)');
  await page.getByRole('button',{name:'Block theme Forest'}).click();

  // Global theme presets must not serialise their UI-only display name.
  await page.locator('.visual-rail-settings button').filter({hasText:'Theme'}).click();
  await page.locator('.visual-presets button').filter({hasText:'Dark'}).click();
  assert.equal(await page.locator('.visual-presets button').count(),3);
  await page.locator('.visual-rail-section').filter({hasText:'Hero'}).locator('.visual-rail-select').click();
  // A block theme can still be set independently of the site's theme.
  await page.getByRole('button',{name:'Block theme Paper'}).click();
  assert.equal(await page.locator('.cms-section-hero').evaluate(el=>getComputedStyle(el).backgroundColor),
    'rgb(247, 248, 243)');
  const darkBackdrop=await page.locator('.portfolio.cms-site').evaluate(el=>
    getComputedStyle(el).backgroundColor);
  assert.equal(darkBackdrop, 'rgb(21, 30, 29)');

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

  // Removing a stat must redistribute all remaining items equally.
  await page.locator('.visual-rail-section').filter({hasText:'Stats / numbers'}).locator('.visual-rail-select').click();
  assert.equal(await page.locator('.cms-section-stats .portfolio-proof-grid>div').count(),4);
  await page.locator('.visual-array-head').filter({hasText:'Items 4'}).locator('button').last().click();
  const tiles=page.locator('.cms-section-stats .portfolio-proof-grid>div');
  assert.equal(await tiles.count(),3,'Removing a stat should leave exactly three');
  const widths=await tiles.evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().width));
  assert(Math.max(...widths)-Math.min(...widths)<2,
    'Remaining stats must automatically use 33.33% of the row each');

  // A custom section anchor should change rendered DOM id and retarget all
  // existing navigation links to the same new section.
  await page.locator('.visual-rail-section').filter({hasText:'Contact'}).locator('.visual-rail-select').click();
  await page.locator('[aria-label="Section anchor"]').fill('reach-me');
  assert.equal(await page.locator('.cms-section-contact').getAttribute('id'),'reach-me');
  assert.equal(await page.locator('.portfolio-header nav a').last().getAttribute('href'),' /#reach-me'.trim());
  const scrollSelect=page.locator('.visual-inspector-body select[aria-label="Choose section to scroll to"]').first();
  await scrollSelect.selectOption('#proof');
  assert.equal(await page.locator('.cms-section-contact .portfolio-button').first().getAttribute('href'),'#proof');

  // Typography, theme overrides and button appearance affect the actual page
  // (not just settings stored in a form).
  await page.locator('[aria-label="Eyebrow Color hex value"]').fill('#ff0000');
  const eyebrow=await page.locator('.cms-section-contact .portfolio-kicker').evaluate(el=>getComputedStyle(el).color);
  assert.equal(eyebrow,'rgb(255, 0, 0)','Eyebrow override not applied to rendered page');
  await page.locator('[aria-label="Primary Background hex value"]').fill('#112233');
  // Buttons animate background colour for 150ms, so wait until the visual
  // transition finishes before asserting its final computed value.
  await page.waitForTimeout(300);
  const buttonBackground=await page.locator('.cms-section-contact .portfolio-button-primary')
    .evaluate(el=>getComputedStyle(el).backgroundColor);
  assert.equal(buttonBackground,'rgb(17, 34, 51)','Button background override did not reach the page');
  await page.locator('[aria-label="Line Height exact value"]').fill('1.8');
  const line=await page.locator('.cms-section-contact p').first().evaluate(el=>({
    line:parseFloat(getComputedStyle(el).lineHeight),size:parseFloat(getComputedStyle(el).fontSize)
  }));
  assert(line.line>line.size*1.7,'Line height should apply immediately to rendered block copy');

  // About layout should be able to switch from side-by-side to full-width text.
  await page.locator('.visual-rail-section').filter({hasText:'About'}).locator('.visual-rail-select').click();
  await page.locator('[aria-label="Columns exact value"]').fill('1');
  const aboutCols=await page.locator('.cms-section-about .portfolio-about').evaluate(
    el=>getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length);
  assert.equal(aboutCols,1,'One-column About layout did not apply');

  // Portfolio cards: grid/list presentation, direct individual edits, hidden
  // cards and persistent settings must work without touching full case studies.
  await page.locator('.visual-rail-section').filter({hasText:'Real work. Real retail.'})
    .locator('.visual-rail-select').click();
  const gallery=page.locator('.cms-section-projects');
  assert.equal(await gallery.locator('.portfolio-project').count(),3);
  await page.getByRole('button',{name:'☰ List'}).click();
  assert(await gallery.evaluate(el=>el.classList.contains('cms-projects-list')),
    'List mode must change the rendered portfolio section');
  const listRects=await gallery.locator('.portfolio-project').evaluateAll(
    nodes=>nodes.map(el=>({x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y,
      width:el.getBoundingClientRect().width})));
  assert(listRects[1].y>listRects[0].y+40,'List layout must put cards on separate rows');
  assert(Math.abs(listRects[0].width-listRects[1].width)<2,'List cards should use equal row widths');
  await gallery.locator('[data-cms-project-slug="loftycards"]').click();
  await page.locator('[aria-label="Card project name"]').fill('LoftyCards Test');
  await page.locator('[aria-label="Card description"]').fill('Edited only for this homepage card.');
  await page.locator('[aria-label="Card result value"]').fill('12,345');
  await page.locator('[aria-label="Card link label"]').fill('See the work');
  assert.equal(await gallery.locator('.portfolio-project').first().locator('h3').innerText(),'LoftyCards Test');
  assert((await gallery.locator('.portfolio-project').first().innerText()).includes('Edited only for this homepage card.'));
  assert((await gallery.locator('.portfolio-project').first().innerText()).includes('12,345'));
  assert((await gallery.locator('.portfolio-project').first().innerText()).includes('See the work'));
  await page.getByRole('checkbox',{name:'Show this card on the homepage'}).uncheck();
  assert.equal(await gallery.locator('.portfolio-project').count(),2,
    'Hidden homepage card must not delete the case study');
  await page.getByRole('checkbox',{name:'Show this card on the homepage'}).check();
  assert.equal(await gallery.locator('.portfolio-project').count(),3);
  await page.getByRole('button',{name:'← Portfolio layout & card order'}).click();
  await page.getByRole('button',{name:'▦ Grid'}).click();
  assert(!await gallery.evaluate(el=>el.classList.contains('cms-projects-list')));
  await page.getByRole('button',{name:'☰ List'}).click();
  await Promise.all([
    page.waitForResponse(response=>response.url().endsWith('/admin/api/cms')&&response.request().method()==='PUT'),
    page.getByRole('button',{name:'Save draft'}).click()
  ]);
  await page.reload({waitUntil:'networkidle'});
  const restoredGallery=page.locator('.cms-section-projects');
  assert(await restoredGallery.evaluate(el=>el.classList.contains('cms-projects-list')),
    'Saved list layout must survive reload');
  assert((await restoredGallery.locator('.portfolio-project').first().innerText()).includes('Edited only for this homepage card.'));
  assert.equal(await restoredGallery.locator('.portfolio-project').count(),3);
  await restoredGallery.locator('[data-cms-project-slug="loftycards"]').click();
  await page.getByRole('button',{name:'Edit full case-study page ↗'}).click();
  await page.locator('.portfolio-detail').waitFor();
  assert.equal(await page.locator('.portfolio-detail').count(),1);

  await page.locator('.visual-rail-page select').selectOption('projects');
  await page.locator('.portfolio-detail').waitFor();
  assert.equal(await page.locator('.visual-page-frame').isVisible(),true);

  // The viewport must remain useful on a narrower real browser too.
  await page.setViewportSize({width:700,height:840});
  await page.locator('.visual-mobile-rail').click();
  assert.equal(await page.locator('.visual-cms-rail').isVisible(),true);
  // Private Work board must be accessible from the overview, not "SOON".
  let workTasks=[];
  const handleTaskRoute=r=>{
    const method=r.request().method();
    if(method==='POST'){
      const item=r.request().postDataJSON();
      workTasks.push({...item,id:1,revision:1,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
      return r.fulfill(json({task:workTasks[0]}));
    }
    if(method==='PUT'){
      const body=r.request().postDataJSON();
      workTasks=workTasks.map(item=>item.id===1?{...body.task,id:1,revision:item.revision+1,
        created_at:item.created_at,updated_at:new Date().toISOString()}:item);
      return r.fulfill(json({task:workTasks[0]}));
    }
    return r.fulfill(json({tasks:workTasks}));
  };
  await page.route('**/admin/api/tasks/*',handleTaskRoute);
  await page.route('**/admin/api/tasks',handleTaskRoute);
  await page.route('**/admin/api/jobs',r=>r.fulfill(json({jobs:[]})));
  const worldContract={
    key:'global-test',company:'Motu Novu Test',title:'Jr E-Commerce Assistant',score:74,
    cv_score:75,lifestyle_score:78,source:'Himalayas',hours:'5-15 hours/week',
    employment_type:'Contractor',location:'Worldwide remote',salary:'$15–25/hr',
    posted:'2026-11-04',state:'new',first_seen:'2026-11-11',last_seen:'2026-11-11',
    role_tags:['Ecommerce'],seniority:'Junior / entry',reason:'Ecommerce tasks.',
    warning:'Confirm UK contractor eligibility',confidence:'review',
    engagement_route:'Independent contractor',
    uk_eligibility:'Worldwide claim — UK terms unverified',cross_border_review:true,
    remote_status:'Remote-labelled (unverified)',hours_fit:'Hours within 30/week',
    fit_evidence:['Worldwide independent-contractor: verify invoicing.'],
    apply_url:'https://example.com/world-job'
  };
  await page.route('**/admin/api/job-matches',r=>r.fulfill(json({
    matches:[worldContract],scan:null,history:[]
  })));
  await page.setViewportSize({width:1400,height:850});
  await page.goto('http://127.0.0.1:5173/admin',{waitUntil:'networkidle'});
  assert.equal(await page.getByRole('link',{name:/Work board/}).count(),2,
    'Overview and sidebar should both link to the ready Work board');
  assert.equal(await page.getByText('Build your website.').count(),0,
    'Overview must not show the old website milestone');
  await page.goto('http://127.0.0.1:5173/admin/tasks',{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'Work board',exact:true,level:2}).waitFor();
  await page.getByRole('button',{name:'+ Add task'}).click();
  await page.getByLabel('Task title').fill('Update LoftyCards listings');
  await Promise.all([
    page.waitForResponse(r=>r.url().endsWith('/admin/api/tasks')&&r.request().method()==='POST'),
    page.getByRole('button',{name:'Save task'}).click()
  ]);
  await page.getByRole('button',{name:'Update LoftyCards listings'}).waitFor();
  assert.equal(await page.getByText('1',{exact:true}).count()>0,true,'Open task count not updated');
  await Promise.all([
    page.waitForResponse(r=>r.url().endsWith('/admin/api/tasks/1')&&r.request().method()==='PUT'),
    page.locator('select[aria-label="Move Update LoftyCards listings to"]').selectOption('in_progress')
  ]);
  assert.equal(workTasks[0].status,'in_progress');
  await page.goto('http://127.0.0.1:5173/admin/job-matches',{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'Job matches'}).waitFor();
  assert.equal(await page.getByText('International contractor — review before applying').count(),1);
  await page.getByLabel('Work arrangement').selectOption('employment');
  assert.equal(await page.getByText('No matching vacancies').count(),1);
  await page.getByRole('button',{name:'Reset filters'}).click();
  assert.equal(await page.getByText('International contractor — review before applying').count(),1);
  console.log('Workspace smoke passed: overview, Work board create/move, overseas job warning and advanced filters.');
  console.log('CMS browser smoke passed: centred canvas, responsive presets, sidebar-only templates, save/reload draft persistence, no recurring prompt, case studies and mobile editing.');
}finally{
  await browser.close();
}
