import asyncio,subprocess,os,time,json,urllib.request
from aiohttp import ClientSession,WSMsgType
ROOT=os.path.dirname(os.path.dirname(__file__))
async def recv(ws,typ,timeout=4):
 for _ in range(15):
  msg=await asyncio.wait_for(ws.receive(),timeout)
  assert msg.type==WSMsgType.TEXT, msg
  d=json.loads(msg.data)
  if d['type']==typ:return d
 raise AssertionError('missing '+typ)
async def main():
 env={**os.environ,'PORT':'18775'}
 server=subprocess.Popen(['python','server.py'],cwd=ROOT,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  for i in range(50):
   try:
    r=urllib.request.urlopen('http://127.0.0.1:18775/health',timeout=1)
    if json.load(r)['ok']:break
   except:await asyncio.sleep(.1)
  else:raise RuntimeError('server not ready')
  async with ClientSession() as session:
   for path in ['/','/online.js','/health']:
    async with session.get('http://127.0.0.1:18775'+path) as r:assert r.status==200,path
   host=await session.ws_connect('http://127.0.0.1:18775/ws')
   await host.send_json({'type':'create','name':'방장','max':4})
   h=await recv(host,'welcome');code=h['code'];assert len(code)==6 and h['seat']==0
   await recv(host,'roster')
   guest=await session.ws_connect('http://127.0.0.1:18775/ws')
   await guest.send_json({'type':'join','code':code,'name':'친구'})
   j=await recv(guest,'welcome');assert j['seat']==1
   await recv(host,'roster');await recv(guest,'roster')
   await host.send_json({'type':'start'})
   await recv(guest,'roster')
   await host.send_json({'type':'snapshot','actor':1,'private':'능력은비밀','public':{'game':'공개보드'}})
   snapshot=await recv(guest,'snapshot')
   assert snapshot['private']=='능력은비밀' and snapshot['public']['game']=='공개보드'
   await guest.send_json({'type':'action','action':{'kind':'action','index':0}})
   action=await recv(host,'action');assert action['seat']==1 and action['action']['index']==0
   # Invalid spectator controls ignored; don't forward unexpected arbitrary actions
   await guest.send_json({'type':'action','action':{'kind':'evil','script':'alert(1)'}})
   try:
    await asyncio.wait_for(host.receive(),.25)
    raise AssertionError('unexpected action forwarded')
   except asyncio.TimeoutError:pass
   await guest.close()
   d=await recv(host,'disconnected');assert d['seat']==1
   await host.close()
   print('PASS HTTP, room, join, start, private snapshot, remote action, action filter, disconnect')
 finally:
  server.terminate();server.wait(timeout=5)
asyncio.run(main())
