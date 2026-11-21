"""Chromium regression tests of the exact production HTML/CSS/JS using mocked HTTP responses.
The local Chromium sandbox forbids navigating localhost; page.set_content uses the production
source combined into our standalone bundle, with STANDALONE disabled and a fake fetch adapter.
This verifies frontend state transitions, NOT real provider connectivity or public hosting.
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
report=ROOT/'docs'/'BROWSER_TRUST_RESULTS.json'
html=(ROOT/'docs'/'SmogSafe_AI_Standalone_Demo.html').read_text(encoding='utf-8')
assert 'window.__SMOGSAFE_STANDALONE__=true;' in html
mock_js=r'''
window.__SMOGSAFE_STANDALONE__=false;
window.__MOCK_FAIL__=false;
window.__MOCK_DELAY_MS__=0;
window.fetch=async (resource, options={})=>{
  const path=String(resource);
  if(path.startsWith('/api/health'))return new Response(JSON.stringify({ok:true,geminiConfigured:false}),{status:200,headers:{'Content-Type':'application/json'}});
  if(path.startsWith('/api/air')){
    if(window.__MOCK_DELAY_MS__) await new Promise(resolve=>setTimeout(resolve,window.__MOCK_DELAY_MS__));
    if(window.__MOCK_FAIL__)return new Response(JSON.stringify({error:'Mocked provider failure'}),{status:503,headers:{'Content-Type':'application/json'}});
    const coords=new URL(path,'https://example.test').searchParams;
    const output={live:true,source:'MOCK ONLY — Open-Meteo modeled forecast',scale:'US AQI',timestamp:'MOCK 2026-11-20T15:00Z',
      snapshotId:'X'.repeat(32),snapshotExpiresAt:new Date(Date.now()+18*60000).toISOString(),
      coordinates:{latitude:Number(coords.get('lat')),longitude:Number(coords.get('lon'))},
      current:{usAqi:215,pm25:90,pm10:120,no2:33,ozone:64},
      hours:Array.from({length:12},(_,i)=>({time:`${String(i+8).padStart(2,'0')}:00`,usAqi:215-i*3,pm25:90-i}))};
    return new Response(JSON.stringify(output),{status:200,headers:{'Content-Type':'application/json'}});
  }
  if(path.startsWith('/api/brief')) return new Response(JSON.stringify({mode:'rules-fallback',brief:'Morning: Choose lower-exposure activity. Afternoon: Combine trips. Evening: Remove smoke sources.'}),{status:200,headers:{'Content-Type':'application/json'}});
  if(path.startsWith('/api/chat')) return new Response(JSON.stringify({answer:'Keep indoor smoke sources low and use appropriate HEPA filtration when feasible.',mode:'rules-fallback'}),{status:200,headers:{'Content-Type':'application/json'}});
  return new Response(JSON.stringify({error:'Unsupported mock route'}),{status:404,headers:{'Content-Type':'application/json'}});
};
'''
html=html.replace('window.__SMOGSAFE_STANDALONE__=true;',mock_js,1)

results=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
    for view,viewport in [('desktop',{'width':1440,'height':900}),('mobile',{'width':390,'height':844})]:
        page=browser.new_page(viewport=viewport,device_scale_factor=1)
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(html,wait_until='load')
        page.locator('#try-live').click()
        page.wait_for_function("document.querySelector('#source-title').textContent === 'MODELED FORECAST ACTIVE'")
        assert page.locator('#current-aqi').inner_text()=='215'
        assert page.locator('#source-subtitle').inner_text().find('expires')>=0
        # Force expiry: UI must no longer display the mocked live AQI.
        page.evaluate("air.snapshotExpiresAt=new Date(Date.now()-1).toISOString();enforceForecastFreshness()")
        assert 'FORECAST UNAVAILABLE' in page.locator('#source-title').inner_text()
        assert page.locator('#current-aqi').inner_text()=='184'
        assert 'invented examples' in page.locator('#source-subtitle').inner_text()
        # Successful reload then provider failure resets the data to unmistakable demo.
        page.locator('#try-live').click()
        page.wait_for_function("document.querySelector('#source-title').textContent === 'MODELED FORECAST ACTIVE'")
        page.evaluate('window.__MOCK_FAIL__=true')
        page.locator('#try-live').click()
        page.wait_for_function("document.querySelector('#source-title').textContent.includes('FORECAST UNAVAILABLE')")
        assert page.locator('#current-aqi').inner_text()=='184'
        # Old in-flight location request must not silently reassign an old city's data.
        page.evaluate('window.__MOCK_FAIL__=false;window.__MOCK_DELAY_MS__=450')
        page.locator('#try-live').click()
        page.locator('#city-input').fill('Pune')
        page.locator('#city-form button[type="submit"]').click()
        page.get_by_role('button',name='Pune, Maharashtra, India').click()
        page.wait_for_timeout(650)
        assert 'Pune' in page.locator('#selected-location').inner_text()
        assert page.locator('#current-aqi').inner_text()=='112'
        assert page.locator('#source-title').inner_text()=='ILLUSTRATIVE DEMO'
        assert not errors,errors
        widths=page.evaluate('({body:document.body.scrollWidth,viewport:innerWidth})')
        assert widths['body']<=widths['viewport']+2,widths
        results.append({'viewport':view,'trustTransitionsPassed':True,'expiredReadingCleared':True,'failedReadingCleared':True,'racedCityRequestIgnored':True,'pageErrors':errors,'horizontalOverflow':False})
        page.close()
    browser.close()
report.write_text(json.dumps(results,indent=2),encoding='utf-8')
print('Browser trust-state regression tests: PASSED',len(results),'viewports')
