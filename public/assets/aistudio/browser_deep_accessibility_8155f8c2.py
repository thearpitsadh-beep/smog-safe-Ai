"""Extended Playwright accessibility smoke tests. Not an axe-core or WCAG certification."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'docs/SmogSafe_AI_Standalone_Demo.html').read_text(encoding='utf8')
REPORT=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
    for label,width,height in [('320px-phone',320,640),('390px-phone',390,844),('200-percent-zoom-equivalent',640,800),('1440px-desktop',1440,900)]:
        page=browser.new_page(viewport={'width':width,'height':height},reduced_motion='reduce')
        exceptions=[]
        page.on('pageerror',lambda err:exceptions.append(str(err)))
        page.set_content(HTML,wait_until='load')
        page.keyboard.press('Tab')
        assert page.evaluate("document.activeElement.classList.contains('skip-link')"),f'{label}: skip navigation missing'
        page.keyboard.press('Enter')
        assert page.locator('#main').count()==1
        assert page.locator('#source-notice[role="status"]').count()==1
        assert page.locator('#forecast-chart[role="img"]').count()==1
        assert page.locator('.hourly-details table caption').count()==1
        assert page.locator('.hourly-details th[scope="col"]').count()==3
        if width<=800: page.locator('#menu-toggle').click()
        page.locator('.nav-item[data-view="impact"]').click()
        assert page.locator('#view-impact').is_visible(),f'{label}: impact view missing'
        # The impact calculator must be operable and described with text, not color alone.
        page.locator('#distance').fill('10')
        page.locator('#impact-form button[type="submit"]').click()
        assert 'kg CO₂e' in page.locator('#impact-explain').inner_text()
        assert 'WRI' in page.locator('#factor-assumptions').inner_text()
        assert page.locator('label[for="car-factor"]').count()==1
        assert page.locator('label[for="alternative-factor"]').count()==1
        assert not exceptions,exceptions
        widths=page.evaluate('({body:document.body.scrollWidth,document:document.documentElement.scrollWidth,viewport:innerWidth})')
        assert max(widths['body'],widths['document'])<=widths['viewport']+2,f'{label}: horizontal overflow {widths}'
        # Targeted normal-text contrast on flat surfaces.
        contrast=page.evaluate('''()=>{
          function rgba(s){const m=s.match(/rgba?\\(([^)]+)\\)/);return m?m[1].split(',').slice(0,3).map(Number):null;}
          function lum(rgb){const channels=rgb.map(n=>{const c=n/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4});return .2126*channels[0]+.7152*channels[1]+.0722*channels[2]}
          function ratio(a,b){const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
          const all=['.page-head .lead','.tiny-label','.chart-footer','.profile-card p','.eyebrow-mini'];
          return all.map(selector=>{const e=document.querySelector(selector);const fg=rgba(getComputedStyle(e).color);let parent=e,bg=null;
            while(parent){const color=rgba(getComputedStyle(parent).backgroundColor);if(color&&getComputedStyle(parent).backgroundColor!=='rgba(0, 0, 0, 0)'){bg=color;break;}parent=parent.parentElement;}
            return {selector,value:Number(ratio(fg,bg||[255,255,255]).toFixed(2))};});
        }''')
        assert all(x['value']>=4.5 for x in contrast),(label,contrast)
        REPORT.append({'viewport':label,'width':width,'interactiveImpact':True,'noHorizontalOverflow':True,'reducedMotion':True,'contrastSamples':contrast,'errors':exceptions})
        page.close()
    browser.close()
path=ROOT/'docs'/'ACCESSIBILITY_EXTENDED_V4.json'
path.write_text(json.dumps(REPORT,indent=2),encoding='utf-8')
print('Extended accessibility smoke checks passed',len(REPORT),'viewports and sample ratios >=4.5:1')
