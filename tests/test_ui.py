import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
root=Path(__file__).resolve().parents[1]
html=(root/'public/index.html').read_text().replace('<script src="/online.js"></script>','<script>\n'+(root/'public/online.js').read_text()+'\n</script>')
async def main():
 async with async_playwright() as pl:
  br=await pl.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  h=await br.new_page();g=await br.new_page();errors=[]
  for name,page in [('host',h),('guest',g)]:page.on('pageerror',lambda e,name=name:errors.append((name,str(e))))
  await h.set_content(html);await g.set_content(html)
  assert await h.locator('#onlineHeaderButton').count()==1
  await h.click('#singleMode');await h.select_option('#count','2');await h.click('#setup button:has-text("게임 시작")')
  assert await h.locator('#players .player').count()==2
  await h.evaluate("() => {Online.role='host';Online.seat=0;Online.max=2;Online.roster=[{seat:0,name:'방장'},{seat:1,name:'친구'}];Online.seats=[0,1];Online.started=true;P[1].ai=false;P[1].name='친구';idx=1;beginTurn()}")
  snapshot=await h.evaluate('''() => {const g=document.getElementById('game').cloneNode(true);g.querySelector('#abilities').innerHTML='<div class="concealed-skills">🔒</div>';return {type:'snapshot',actor:1,private:onlinePrivateHtml(),public:{game:onlineScrub(g),vote:onlineScrub(document.getElementById('powerVote').cloneNode(true)),modal:onlineScrub(document.getElementById('modal').cloneNode(true))}}}''')
  await g.evaluate('d => {Online.role="guest";Online.seat=1;Online.roster=[{seat:0,name:"방장"},{seat:1,name:"친구"}];onlineRender(d)}',snapshot)
  assert await g.locator('#players .player').count()==2
  print('GUEST_ABILITY',repr(await g.locator('#abilities').inner_text()),'SNAP',len(snapshot['private']))
  await h.evaluate("() => onlineHostAction({seat:1,action:{kind:'action',index:0}})")
  await h.wait_for_timeout(1500)
  assert await h.locator('#throwResult').inner_text()!='윷을 던져 주세요'
  assert not errors,errors
  print('PASS start, 2 players, guest private display, remote throw, JS errors=0')
  await br.close()
asyncio.run(main())
