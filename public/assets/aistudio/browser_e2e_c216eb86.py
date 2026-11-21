"""Real local browser smoke tests for the upgraded SmogSafe app (no external services)."""
from __future__ import annotations
import json
import os
import socket
import subprocess
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / 'docs' / 'BROWSER_E2E_RESULTS.json'

def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def wait_url(url, deadline=12):
    started=time.monotonic()
    while time.monotonic()-started < deadline:
        try:
            with urllib.request.urlopen(url,timeout=1) as r:
                if r.status == 200:return
        except Exception:
            time.sleep(.2)
    raise RuntimeError('Server did not become ready')


def navigate(page,view,label):
    if label=='mobile':page.locator('#menu-toggle').click()
    page.locator(f'.sidebar button[data-view="{view}"]').click()

def browser_run():
    results=[]
    html=(ROOT/'docs'/'SmogSafe_AI_Standalone_Demo.html').read_text(encoding='utf-8')
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
            for label, viewport in [('desktop',{'width':1440,'height':900}),('mobile',{'width':390,'height':844})]:
                page=browser.new_page(viewport=viewport,device_scale_factor=1)
                errors=[]
                page.on('pageerror',lambda err:errors.append(str(err)))
                page.set_content(html,wait_until='load')
                assert page.get_by_text('Breathe better,').count()>=1
                assert page.locator('#source-title').inner_text()=='ILLUSTRATIVE DEMO'
                assert '184' in page.locator('#current-aqi').inner_text()
                page.locator('.hourly-details summary').click()
                assert page.locator('#forecast-rows tr').count()==12
                navigate(page,'plan',label)
                assert page.locator('#view-plan').is_visible()
                assert page.locator('#plan-action-list article').count()==3
                page.locator('#generate-ai-brief').click()
                assert 'Morning:' in page.locator('#ai-brief-content').inner_text()
                assert 'RULE-BASED' in page.locator('#ai-brief-mode').inner_text()
                navigate(page,'impact',label)
                assert page.locator('#view-impact').is_visible()
                assert '17.5' in page.locator('#saved-emissions').inner_text()
                page.locator('#car-factor').fill('0.24')
                page.locator('#alternative-factor').fill('0.05')
                page.locator('#impact-form button[type="submit"]').click()
                assert page.locator('#saved-emissions').inner_text()=='22.8'
                navigate(page,'copilot',label)
                page.locator('#chat-input').fill('How can I reduce indoor smoke?')
                page.locator('#send-chat').click()
                page.wait_for_timeout(90)
                assert page.locator('#chat-messages .message.assistant').count()>=2
                assert 'indoor source control' in page.locator('#chat-messages .message.assistant').last.inner_text().lower()
                navigate(page,'overview',label)
                page.locator('#city-input').fill('Pune')
                page.locator('#city-form button[type="submit"]').click()
                page.get_by_role('button',name='Pune, Maharashtra, India').click()
                assert 'Pune' in page.locator('#selected-location').inner_text()
                page.locator('#children').uncheck()
                page.locator('#seniors').check()
                page.locator('#profile-form button[type="submit"]').click()
                assert page.locator('#current-aqi').inner_text()=='112'
                widths=page.evaluate('({body:document.body.scrollWidth,view:innerWidth})')
                assert widths['body']<=widths['view']+2, f'Unexpected page overflow: {widths}'
                assert not errors, f'Browser JS errors: {errors}'
                if label=='desktop':
                    page.screenshot(path=str(ROOT/'docs'/'SmogSafe_AI_Pro_Desktop.png'),full_page=True)
                else:
                    page.screenshot(path=str(ROOT/'docs'/'SmogSafe_AI_Pro_Mobile.png'),full_page=True)
                # Re-enter overview for a clean contrast sample.
                contrast=page.evaluate('''() => {
                  function rgb(s){ const x=s.match(/rgba?\\(([^)]+)\\)/); return x?x[1].split(',').slice(0,3).map(v=>Number(v.trim())):null;}
                  function lum(a){ const [r,g,b]=a.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}); return .2126*r+.7152*g+.0722*b;}
                  function ratio(a,b){const l1=lum(a),l2=lum(b);return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);}
                  const selectors=['.page-head .lead','.eyebrow-mini','.tiny-label','.chart-key','.profile-card p','.chart-footer'];
                  return selectors.map(sel=>{const el=document.querySelector(sel);if(!el)return {selector:sel,missing:true};const fg=rgb(getComputedStyle(el).color); let node=el;let bg=null;while(node){const st=getComputedStyle(node);const match=st.backgroundColor;const vals=rgb(match);if(vals && !/rgba\\([^)]*,\\s*0\\)/.test(match) && st.backgroundColor!=='rgba(0, 0, 0, 0)'){bg=vals;break;}node=node.parentElement;}
                    bg??=[255,255,255];return {selector:sel,ratio:Number(ratio(fg,bg).toFixed(2)),foreground:fg,background:bg};});
                }''')
                results.append({'viewport':label,'passed':True,'browserErrors':errors,'horizontalOverflow':False,'contrastSamples':contrast,'forecastTableRows':12})
                page.close()
            browser.close()
        REPORT.write_text(json.dumps(results,indent=2))
        print('Offline app browser E2E passed:',len(results),'viewports. Results:',REPORT)
        for r in results:print(r['viewport'],'contrast',r['contrastSamples'])
    finally:
        pass

if __name__=='__main__':browser_run()
