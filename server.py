"""Superpower Yutnori online relay. Requires aiohttp >=3.9.
Host browser is authoritative. All messages are seat checked and transmitted over WebSocket.
"""
import asyncio, json, os, random, string, time
from pathlib import Path
from aiohttp import web, WSMsgType

ROOT=Path(__file__).parent
rooms={}
MAX_BYTES=250_000

def code_new():
    for _ in range(50):
        c=''.join(random.choices(string.ascii_uppercase+string.digits,k=6))
        if c not in rooms:return c
    raise RuntimeError('code capacity')

def roster(r):
    return {'type':'roster','code':r['code'],'max':r['max'],'started':r['started'],
            'players':[{'seat':seat,'name':p['name']} for seat,p in sorted(r['members'].items())]}

async def send(ws,obj):
    if not ws.closed:await ws.send_json(obj)

async def broadcast(r,obj,except_seat=None):
    for seat,p in list(r['members'].items()):
        if seat!=except_seat:
            try:await send(p['ws'],obj)
            except Exception:pass

async def socket(request):
    ws=web.WebSocketResponse(heartbeat=25,max_msg_size=MAX_BYTES)
    await ws.prepare(request)
    seat=None;r=None
    try:
        async for msg in ws:
            if msg.type!=WSMsgType.TEXT:break
            try:
                data=json.loads(msg.data)
                typ=data.get('type','')
                if r is None:
                    if typ=='create':
                        maximum=int(data.get('max',4));
                        if maximum not in (2,3,4):raise ValueError('방 인원은 2~4명입니다.')
                        roomcode=code_new()
                        r={'code':roomcode,'max':maximum,'members':{},'started':False,'snapshot':None,'last':time.monotonic()}
                        rooms[roomcode]=r;seat=0
                    elif typ=='join':
                        roomcode=str(data.get('code','')).strip().upper()
                        r=rooms.get(roomcode)
                        if not r:raise ValueError('방을 찾을 수 없습니다.')
                        if r['started']:raise ValueError('이미 게임이 시작됐습니다.')
                        if len(r['members'])>=r['max']:raise ValueError('방이 가득 찼습니다.')
                        seat=next(i for i in range(1,r['max']) if i not in r['members'])
                    else:raise ValueError('방 만들기 또는 참가를 선택해 주세요.')
                    name=str(data.get('name','')).strip()[:15] or ('방장' if seat==0 else f'플레이어 {seat+1}')
                    r['members'][seat]={'name':name,'ws':ws}
                    await send(ws,{'type':'welcome','seat':seat,'code':r['code'],'max':r['max']})
                    await broadcast(r,roster(r))
                    continue
                r['last']=time.monotonic()
                if typ=='start':
                    if seat!=0:raise ValueError('방장만 게임을 시작할 수 있습니다.')
                    if len(r['members'])<2:raise ValueError('온라인 멀티플레이에는 최소 2명이 필요합니다.')
                    r['started']=True
                    await broadcast(r,roster(r))
                elif typ=='snapshot':
                    if seat!=0 or not r['started']:continue
                    # The public view is scrubbed by the host and private ability HTML is sent ONLY to current actor.
                    public=data.get('public',{})
                    cue=data.get('cue',{}) if isinstance(data.get('cue',{}),dict) else {}
                    raw=json.dumps(public,ensure_ascii=False)
                    if len(raw)>140_000:continue
                    actor=int(data.get('actor',-1));private=str(data.get('private',''))[:8_000]
                    r['snapshot']={'public':public,'actor':actor,'private':private,'cue':cue}
                    for s,p in list(r['members'].items()):
                        if s==0:continue
                        await send(p['ws'],{'type':'snapshot','public':public,'actor':actor,
                                            'private':private if s==actor else '', 'cue':cue})
                elif typ=='action':
                    if seat==0 or not r['started']:continue
                    a=data.get('action',{})
                    if not isinstance(a,dict):continue
                    # Only an explicit finite action grammar is forwarded to host, no arbitrary JS.
                    if a.get('kind') not in ('action','ability','pick','piece','boardPiece','destination','node','vote'):continue
                    if len(json.dumps(a))>300:continue
                    host=r['members'].get(0)
                    if host:await send(host['ws'],{'type':'action','seat':seat,'action':a})
                elif typ=='ping':await send(ws,{'type':'pong'})
            except (ValueError,TypeError,KeyError) as ex:
                await send(ws,{'type':'error','message':str(ex)})
            except Exception as ex:
                print('socket operation failed:',ex,flush=True)
                await send(ws,{'type':'error','message':'요청을 처리하지 못했습니다.'})
    finally:
        if r and seat in r['members'] and r['members'][seat]['ws'] is ws:
            r['members'].pop(seat,None)
            if seat==0:
                await broadcast(r,{'type':'closed','message':'방장이 연결을 종료했습니다.'})
                rooms.pop(r['code'],None)
            else:
                if r['started']:
                    await broadcast(r,{'type':'disconnected','seat':seat,'message':'참가자가 연결을 종료했습니다. 게임을 재시작해 주세요.'})
                else:await broadcast(r,roster(r))
    return ws

async def index(_):return web.FileResponse(ROOT/'public'/'index.html',headers={'Cache-Control':'no-store'})
async def health(_):return web.json_response({'ok':True,'rooms':len(rooms)})
app=web.Application(client_max_size=MAX_BYTES)
app.router.add_get('/',index)
app.router.add_get('/online.js',lambda req: web.FileResponse(ROOT/'public'/'online.js',headers={'Cache-Control':'no-store'}))
app.router.add_get('/ws',socket)
app.router.add_get('/health',health)
if __name__=='__main__':
    port=int(os.environ.get('PORT','8080'))
    print(f'Yutnori online server at http://0.0.0.0:{port}',flush=True)
    web.run_app(app,host='0.0.0.0',port=port)
