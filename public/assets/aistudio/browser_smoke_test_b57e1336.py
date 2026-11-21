"""Run product-level smoke tests against the fully bundled offline demo.
Requires Python playwright + Chromium; these are optional development tools, not app runtime dependencies.
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

HTML=(Path(__file__).resolve().parent/'SmogSafe_AI_Standalone_Demo.html').read_text(encoding='utf-8')
async def navigate(page,section,mobile):
    if mobile:
        await page.locator('#menu-toggle').click()
    await page.locator(f'.nav-item[data-view="{section}"]').click(timeout=2500)

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        for width,height in [(1440,980),(390,844)]:
            mobile=width<600
            page=await browser.new_page(viewport={'width':width,'height':height})
            errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
            page.set_default_timeout(3000)
            await page.set_content(HTML,wait_until='load')
            assert await page.locator('#overview-actions article').count()==3
            assert (await page.locator('#menu-toggle').is_visible()) is mobile
            await page.locator('#city-input').fill('Pune')
            await page.locator('#city-form button[type=submit]').click()
            await page.locator('#search-results button').first.click()
            assert 'Pune' in await page.locator('#selected-location').inner_text()
            assert await page.locator('#current-aqi').inner_text()=='112'
            await page.locator('#commute').select_option('metro')
            await page.locator('#profile-form button[type=submit]').click()
            await navigate(page,'plan',mobile)
            assert await page.locator('#plan-action-list .plan-card').count()==3
            assert 'metro' in (await page.locator('#plan-action-list').inner_text()).lower()
            await navigate(page,'impact',mobile)
            await page.locator('#distance').fill('12')
            await page.locator('#impact-form button[type=submit]').click()
            assert await page.locator('#saved-emissions').inner_text()=='16.2'
            await navigate(page,'copilot',mobile)
            await page.locator('#chat-input').fill('How do I improve indoor air?')
            await page.locator('#send-chat').click()
            assert await page.locator('#chat-messages .message').count()==3
            assert not errors,errors
            print(f'PASS — {width}px: city selection, household plan, impact calculator, chat fallback and navigation')
            await page.close()
        await browser.close()

if __name__=='__main__':asyncio.run(main())
