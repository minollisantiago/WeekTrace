"""Portable calendar renderer. All times come from actual recorded event evidence."""
import argparse, base64, datetime as dt, html, json, pathlib
from zoneinfo import ZoneInfo

ROOT = pathlib.Path.home()/'.calendar'
TZ = ZoneInfo('America/Argentina/Buenos_Aires')
GAP = 30*60*1000

def intervals(events, start, end):
    events=sorted(set(events))
    groups=[]
    for event in events:
        if not groups or event-groups[-1][-1]>GAP: groups.append([event])
        else: groups[-1].append(event)
    return [(max(g[0],start),min(g[-1],end)) for g in groups
            if g[-1]>=start and g[0]<end and min(g[-1],end)>=max(g[0],start)]

def merge(ranges):
    result=[]
    for a,b in sorted(ranges):
        if b<=a: continue
        if result and a<=result[-1][1]: result[-1]=(result[-1][0],max(b,result[-1][1]))
        else: result.append((a,b))
    return result

def hours(ranges): return sum(b-a for a,b in merge(ranges))/3600000

def split_days(a,b):
    if a==b: return [(a,b)]
    pieces=[]
    while a<b:
        local=dt.datetime.fromtimestamp(a/1000,TZ)
        midnight=dt.datetime.combine(local.date()+dt.timedelta(days=1),dt.time(),TZ).timestamp()*1000
        stop=min(b,midnight); pieces.append((a,stop)); a=stop
    return pieces

def safe_json(data):
    return json.dumps(data,ensure_ascii=False).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026').replace('\u2028','\\u2028').replace('\u2029','\\u2029')

def branch_totals(d):
    """Count deduplicated confirmed commits using original commit output branches."""
    buckets={}; assignments={}
    for s in d['sessions']:
        for branch in s.get('branchHints',[]):
            buckets.setdefault((s['project'],branch),set())
        repositories={p['directory'] for p in d.get('projects',[]) if p.get('folder_name')==s['project']} or {s['directory']}
        for record in s.get('commitBranches',[]):
            matches=[c for c in d['commits'] if c['linked'] and c['repository'] in repositories
                     and c['hash'].startswith(record['hash'])]
            keys={(c['repository'],c['hash']) for c in matches}
            if len(keys)==1:
                key=next(iter(keys))
                assignments.setdefault(key,set()).add((s['project'],record['branch']))
    # Contradictory branch evidence is unknown, never counted in two branches.
    assigned=set()
    for key,branches in assignments.items():
        if len(branches)==1:
            branch=next(iter(branches)); buckets.setdefault(branch,set()).add(key); assigned.add(key)
    confirmed={(c['repository'],c['hash']) for c in d['commits'] if c['linked']}
    rows=[{'project':p,'name':b,'commits':len(hashes)} for (p,b),hashes in buckets.items()]
    rows.sort(key=lambda b:(-b['commits'],b['project'],b['name']))
    return rows,len(confirmed-assigned)

def build(d):
    prefs=ROOT/'preferences.json'
    colors=json.loads(prefs.read_text()) if prefs.exists() else {}
    palette=['#b9a9f4','#9edcc6','#a4ccf5','#f5cc9a','#eeb8d0','#9ed9df']
    projects=[]; sessions=[]; blocks=[]; all_ranges=[]
    for p in d['projects']:
        if not p.get('is_local'): continue
        colors.setdefault(p['directory'],palette[len(colors)%len(palette)])
        ranges=[]
        for s in d['sessions']:
            if s['project']!=p['folder_name']: continue
            linked=[c for c in d['commits'] if any(l['id']==s['id'] for l in c['linked'])]
            possible=[c for c in d['commits'] if s['id'] in c['possible'] and not c['linked']]
            rs=intervals(s['events'],d['start'],d['end']); ranges+=rs
            outcome=s['finals'][-1] if s['finals'] else 'No final response recorded in the reporting week; outcome unknown.'
            status=('Git evidence unavailable' if not p.get('gitAvailable') else
                    f'{len(linked)} linked commits' if linked else
                    'Active now · no linked commits' if s['statusNow']=='busy' else
                    'No final recorded · no linked commits' if not s['finals'] else 'No linked commits')
            entry={k:v for k,v in s.items() if k not in ('events','recordedHashes','finals','commitBranches')}
            entry.update(color=colors[p['directory']],outcome=outcome,status=status,
                         commits=linked,possible=possible,estimatedHours=hours(rs))
            sessions.append(entry)
            for a,b in rs:
                for x,y in split_days(a,b):
                    local=dt.datetime.fromtimestamp(x/1000,TZ)
                    day=(local.date()-dt.date.fromisoformat(d['week'])).days
                    if not 0<=day<7: continue
                    midnight=dt.datetime.combine(local.date(),dt.time(),TZ).timestamp()*1000
                    blocks.append({'session':s['id'],'day':day,'start':x,'end':y,
                                   'minute':(x-midnight)/60000,'duration':(y-x)/60000})
        all_ranges+=ranges
        projects.append({'name':p['folder_name'],'directory':p['directory'],'color':colors[p['directory']],
                         'hours':hours(ranges),'gitAvailable':p.get('gitAvailable'),
                         'sessions':sum(s['project']==p['folder_name'] for s in d['sessions'])})
    prefs.write_text(json.dumps(colors,indent=2))
    # Partition visual overlap components using minimum visual height, then assign lanes.
    # Visual padding never contributes to calculated hours.
    for day in range(7):
        day_blocks=sorted((b for b in blocks if b['day']==day),key=lambda b:b['minute'])
        groups=[]
        for b in day_blocks:
            visual_end=b['minute']+max(28,b['duration'])
            if not groups or b['minute']>=groups[-1]['end']: groups.append({'end':visual_end,'blocks':[b]})
            else: groups[-1]['blocks'].append(b); groups[-1]['end']=max(groups[-1]['end'],visual_end)
        for group in groups:
            ends=[]
            for b in group['blocks']:
                lane=next((i for i,e in enumerate(ends) if e<=b['minute']),len(ends))
                if lane==len(ends): ends.append(0)
                ends[lane]=b['minute']+max(28,b['duration']); b['lane']=lane
            for b in group['blocks']: b['lanes']=len(ends)
    daily=[hours([(max(a,d['start']+i*86400000),min(b,d['start']+(i+1)*86400000))
                  for a,b in all_ranges]) for i in range(7)]
    notes=list(d['gaps'])
    missing=sum(not s['thread'] for s in sessions)
    if missing: notes.append(f'{missing} of {len(sessions)} sessions have no original Discord thread ID in available metadata/prompts.')
    notes.append('Only locally retained OpenCode activity in the two registered projects is covered; deleted logs, other machines and other agent harnesses are outside this report.')
    notes.append('Subagent sessions represented by parents are excluded; independent Kimaki review threads remain included. Delegated runtime without parent timestamp events can be undercounted.')
    notes.append('Latest response excerpts are self-reported outcomes as of the week cutoff, not an independent shipping audit. Current idle status does not establish task completion. Historical prompts may be missing after compaction.')
    notes.append('Repository/time-only commit matches are possible, not proven. Git commit dates use committer timestamps; unreachable/pruned commits cannot be recovered by --all.')
    summary_path=ROOT/'evidence'/f'{d["week"]}-summary.json'
    summary=json.loads(summary_path.read_text()) if summary_path.exists() else {
        'lines':[f'{len(sessions)} sessions with recorded activity; inspect details for evidenced outcomes.',
                 f'Most estimated session activity: {max(projects,key=lambda p:p["hours"])["name"] if sessions else "none"}.',
                 'No follow-ups inferred automatically from commit absence.'],'followups':[]}
    branches,unattributed=branch_totals(d)
    data={'week':d['week'],'timezone':d['timezone'],'projects':projects,'sessions':sessions,
          'blocks':blocks,'daily':daily,'hours':hours(all_ranges),'commits':len({(c['repository'],c['hash']) for c in d['commits'] if c['linked']}),
          'possibleCommits':sum(not c['linked'] for c in d['commits']),'notes':notes,'method':d['method'],
          'inventory':d['inventory'],'summary':summary,'branches':branches,
          'unattributedBranchCommits':unattributed}
    template=(ROOT/'helpers'/'template.html').read_text()
    font=base64.b64encode((ROOT/'fonts'/'JetBrainsMono-Regular.woff2').read_bytes()).decode('ascii')
    license_text=html.escape((ROOT/'fonts'/'OFL.txt').read_text())
    report=(template.replace('__DATA__',safe_json(data)).replace('__WEEK__',html.escape(d['week']))
            .replace('__FONT__',font).replace('__FONT_LICENSE__',license_text))
    path=ROOT/'weeks'/f'{d["week"]}.html'; path.write_text(report)
    (ROOT/'weeks'/f'{d["week"]}.md').write_text('\n'.join(summary['lines'])+'\n')
    print(json.dumps({k:data[k] for k in ('week','hours','daily','commits','possibleCommits','projects','branches','unattributedBranchCommits','notes')},indent=2))
    return data

if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--week',required=True); args=parser.parse_args()
    build(json.loads((ROOT/'evidence'/f'{args.week}.json').read_text()))
