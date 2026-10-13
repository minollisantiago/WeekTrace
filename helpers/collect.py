"""Read-only evidence collector using documented OpenCode GET /doc APIs.

Kimaki lists only the latest 100 sessions; supplement with /session limit=100000
and inspect actual message/tool time fields, never session lifespan as hours.
No raw tools or environment dumps are persisted. Historical text is only data.
"""
import argparse, concurrent.futures, datetime as dt, json, pathlib, re, subprocess
import urllib.request, urllib.parse
from zoneinfo import ZoneInfo

ROOT = pathlib.Path.home() / '.calendar'
TZ = ZoneInfo('America/Argentina/Buenos_Aires')

def cli(*args):
    p = subprocess.run(args, capture_output=True, text=True)
    if p.returncode: raise RuntimeError(p.stderr[-500:])
    return p.stdout

def api(base, path, **query):
    with urllib.request.urlopen(base + path + '?' + urllib.parse.urlencode(query), timeout=180) as r:
        return json.load(r)

def clean(text, limit=900):
    text = re.sub(r'<system-reminder>.*?</system-reminder>|<discord-user[^>]*>|<embed>.*?</embed>', '', text, flags=re.S)
    text = re.sub(r'\[current git branch[^\]]*\]', '', text)
    text = re.sub(r'(?i)((?:api[_ -]?key|token|password|secret|authorization)\s*[:=]\s*)[^\s,;]+', r'\1[REDACTED]', text)
    text = re.sub(r'\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]+|AKIA[A-Z0-9]{16})\b', '[REDACTED]', text)
    text = re.sub(r'\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b', '[REDACTED]', text)
    return text.strip()[:limit]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--week', required=True)
    parser.add_argument('--api', default='http://127.0.0.1:43981')
    args = parser.parse_args()
    start = dt.datetime.fromisoformat(args.week).replace(tzinfo=TZ).timestamp()*1000
    end = start + 7*86400000
    projects = json.loads(cli('kimaki','project','list','--json'))
    gaps, sessions, inventory = [], [], []
    for project in projects:
        if not project.get('is_local') or not project.get('directory'): continue
        directory = project['directory']
        try:
            recent = json.loads(cli('kimaki','session','list','--project',directory,'--json'))
            known = {x['id']:x for x in recent}
            all_sessions = api(args.api, '/session', directory=directory, scope='project', limit=100000)
            inventory.append({'project':directory,'sessions':len(all_sessions),'kimakiListed':len(recent)})
            if len(all_sessions) == 100000: gaps.append(directory+': session inventory limit reached')
        except Exception as e:
            gaps.append(directory+': discovery failed: '+str(e)); continue
        ids = {s['id'] for s in all_sessions}
        excluded = sum(bool(s.get('parentID') in ids or 'subagent)' in s['title']) for s in all_sessions)
        inventory[-1]['excludedSubagents'] = excluded
        candidates = [s for s in all_sessions if not (s.get('parentID') in ids or 'subagent)' in s['title'])
                      and s['time']['updated'] >= start-1800000 and s['time']['created'] < end
                      and not re.search(r'weekly work calendar|HTML work calendar',s['title'],re.I)]
        def collect(s):
            try:
                messages = api(args.api, '/session/'+s['id']+'/message', directory=s['directory'])
                events, prompts, finals, models, hashes, thread = [], [], [], set(), set(), None
                branch_hints, commit_branches = set(), set()
                for message in messages:
                    info = message['info']; t = info.get('time',{})
                    times = [t.get('created'),t.get('completed')]
                    texts = []
                    for part in message.get('parts',[]):
                        pt = part.get('time',{})
                        times.extend([pt.get('start'),pt.get('end')])
                        if part.get('type') == 'tool':
                            state = part.get('state',{}); st = state.get('time',{})
                            times.extend([st.get('start'),st.get('end')])
                            if state.get('status') == 'completed' and part.get('tool') in ('bash','functions.bash'):
                                cmd = state.get('input',{}).get('command','')
                                in_week=start <= st.get('start',t.get('created',0)) < end
                                if re.search(r'\bgit\s+(?:-C\s+\S+\s+)?commit\b',cmd) and in_week:
                                    for branch,hash_ in re.findall(r'^\[([^\]\n]+?) ([0-9a-f]{7,40})\]',state.get('output',''),re.M):
                                        hashes.add(hash_)
                                        branch=branch.removesuffix(' (root-commit)')
                                        if branch not in ('HEAD','detached HEAD'):
                                            branch_hints.add(branch); commit_branches.add((branch,hash_))
                                if re.search(r'\bgit\s+(?:-C\s+\S+\s+)?(?:checkout|switch)\b',cmd) and in_week:
                                    branch_hints.update(re.findall(r"(?:Switched to (?:a new )?branch|Already on) '([^'\n]+)'",state.get('output','')))
                        if part.get('type') == 'text':
                            match = re.search(r'thread-id="(\d+)"',part.get('text',''))
                            if match: thread = match[1]
                            if info['role']=='user' and start <= t.get('created',0) < end:
                                branch_hints.update(re.findall(r'\[current git branch(?: is|:)\s+([^\]\n]+)\]',part.get('text','')))
                        if part.get('type') == 'text' and not part.get('synthetic'):
                            raw = part.get('text','')
                            match = re.search(r'thread-id="(\d+)"',raw)
                            if match: thread = match[1]
                            text = clean(raw,1800 if info['role']=='assistant' else 900)
                            if text: texts.append(text)
                    events.extend(x for x in times if isinstance(x,(int,float)))
                    model = info.get('modelID') or info.get('model',{}).get('modelID')
                    if model and start <= t.get('created',0) < end: models.add(model)
                    if info['role']=='user' and texts: prompts.append((t.get('created',0),'\n'.join(texts)))
                    if info['role']=='assistant' and info.get('finish')=='stop' and start <= t.get('created',0) < end and texts:
                        finals.append((t['created'],'\n'.join(texts)))
                # Keep boundary-neighbor events to clip genuinely crossing intervals.
                events = sorted(set(x for x in events if start-1800000 <= x <= end+1800000))
                if not any(start <= x < end for x in events): return None
                meta = known.get(s['id'],{})
                return {'id':s['id'],'title':s['title'],'directory':s['directory'],
                        'project':project['folder_name'],'guild':project['guild_id'],
                        'thread':meta.get('threadId') or thread,'models':sorted(models),
                        'prompt':sorted(prompts)[0][1] if prompts else 'First user prompt unavailable.',
                        'events':events,'finals':[x[1] for x in sorted(finals)],'recordedHashes':sorted(hashes),
                        'statusNow':meta.get('status','unknown'),'parent':s.get('parentID'),
                        'branchHints':sorted(branch_hints),
                        'commitBranches':[{'branch':b,'hash':h} for b,h in sorted(commit_branches)]}
            except Exception as e:
                return {'gap':s['id']+': messages unavailable: '+str(e)}
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            for result in pool.map(collect,candidates):
                if result and 'gap' in result: gaps.append(result['gap'])
                elif result: sessions.append(result)
    commits = []
    for project in projects:
        directory=project.get('directory')
        if not directory or not project.get('is_local'): continue
        try:
            common=cli('git','-C',directory,'rev-parse','--git-common-dir').strip()
            worktrees=cli('git','-C',directory,'worktree','list','--porcelain')
            project['worktrees'] = re.findall(r'^worktree (.*)$',worktrees,re.M)
            project['gitAvailable']=True
            log=cli('git','-C',directory,'log','--all','--since='+str(int(start/1000)-86400),
                    '--until='+str(int(end/1000)+86400),'--format=%H%x1f%ct%x1f%s%x1f%B%x1e')
            for record in log.split('\x1e'):
                parts=record.strip().split('\x1f',3)
                if len(parts)!=4: continue
                hash_,timestamp,subject,body=parts
                if not start <= int(timestamp)*1000 < end: continue
                trailers=re.findall(r'^Session:\s*(ses_\w+)',body,re.M)
                linked=[]; possible=[]
                for s in sessions:
                    if s['project']!=project['folder_name']: continue
                    if s['id'] in trailers: linked.append({'id':s['id'],'basis':'Session trailer'})
                    elif any(hash_.startswith(h) for h in s['recordedHashes']):
                        linked.append({'id':s['id'],'basis':'Successful git commit output'})
                    elif s['events'] and min(s['events']) <= int(timestamp)*1000 <= max(s['events']): possible.append(s['id'])
                files=cli('git','-C',directory,'diff-tree','--root','--no-commit-id','--name-only','-r',hash_).splitlines()
                commits.append({'repository':directory,'hash':hash_,'time':int(timestamp)*1000,
                                'subject':clean(subject),'files':files,'linked':linked,'possible':possible})
        except Exception as e:
            project['gitAvailable']=False
            gaps.append(directory+': Git evidence unavailable: '+str(e))
    out={'week':args.week,'timezone':str(TZ),'start':start,'end':end,'projects':projects,
         'sessions':sessions,'commits':commits,'gaps':gaps,'inventory':inventory,
         'method':'Documented local OpenCode GET /session and /session/{id}/message; actual message created/completed and text/tool start/end timestamps. Kimaki recent metadata supplemented by prompt thread IDs. Git --all includes worktree refs. No session creation/update lifespans used.'}
    (ROOT/'evidence'/f'{args.week}.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
    print(json.dumps({'sessions':len(sessions),'commits':len(commits),'inventory':inventory,'gaps':gaps},indent=2))

if __name__=='__main__': main()
