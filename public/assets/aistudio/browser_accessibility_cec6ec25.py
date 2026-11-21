"""Focused offline keyboard/reflow/accessible-label smoke checks; not a complete WCAG audit."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
html=(root/'docs/SmogSafe_AI_Standalone_Demo.html').read_text(encoding='utf8')
results=[]
with sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
    for name,width,height in [('small-mobile',320,640),('phone',390,844),('desktop',1440,900)]:
        page=browser.new_page(viewport={'width':width,'height':height})
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(html,wait_until='load')
        page.keyboard.press('Tab')
        assert page.evaluate('document.activeElement.className')=='skip-link',name
        assert page.locator('.skip-link').is_visible(),name
        buttons=page.locator('button').all()
        unlabeled=[]
        for button in buttons:
            if not button.is_visible():continue
            info=button.evaluate('el=>({text:el.textContent.trim(),aria:el.getAttribute("aria-label"),title:el.getAttribute("title")})')
            if not (info['text'] or info['aria'] or info['title']):unlabeled.append(info)
        assert not unlabeled,unlabeled
        assert page.locator('label[for="city-input"]').count()==1
        assert page.locator('label[for="distance"]').count()>=1
        assert page.locator('#source-notice[role="status"]').count()==1
        sizes=page.evaluate('({doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,width:innerWidth})')
        assert max(sizes['doc'],sizes['body'])<=sizes['width']+2,(name,sizes)
        assert errors==[],errors
        results.append({'viewport':name,'width':width,'skipLinkKeyboardFocus':True,'visibleButtonsLabeled':True,'formLabelsPresent':True,'liveDataStatusAccessible':True,'horizontalOverflow':False,'runtimeErrors':errors})
        page.close()
    browser.close()
(root/'docs'/'ACCESSIBILITY_SMOKE_RESULTS.json').write_text(json.dumps(results,indent=2),encoding='utf8')
print('Accessibility smoke tests passed:',len(results),'viewports')
