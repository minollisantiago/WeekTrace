"""Regression checks for historical branch attribution, not current containment."""
import unittest
from generate import branch_totals

class BranchTests(unittest.TestCase):
    def test_deduplicates_shared_session_evidence_and_supports_worktrees(self):
        session={'project':'App','directory':'/app-worktree','branchHints':['feature','research'],
                 'commitBranches':[{'branch':'feature','hash':'1234567'}]}
        commit={'repository':'/app','hash':'1234567abcdef','linked':[{'id':'s1'}]}
        data={'projects':[{'folder_name':'App','directory':'/app'}],
              'sessions':[session,session],'commits':[commit,commit]}
        rows,unknown=branch_totals(data)
        self.assertEqual(rows,[{'project':'App','name':'feature','commits':1},
                               {'project':'App','name':'research','commits':0}])
        self.assertEqual(unknown,0)

    def test_conflicting_or_ambiguous_evidence_is_not_double_counted(self):
        sessions=[{'project':'App','directory':'/app','branchHints':['a','b'],
                   'commitBranches':[{'branch':'a','hash':'1234567'},
                                     {'branch':'b','hash':'1234567'},
                                     {'branch':'a','hash':'7654321'}]}]
        commits=[{'repository':'/app','hash':h,'linked':[{'id':'s'}]}
                 for h in ('1234567abcdef','7654321aaaa','7654321bbbb','deadbee1234')]
        rows,unknown=branch_totals({'sessions':sessions,'commits':commits})
        self.assertEqual(sum(r['commits'] for r in rows),0)
        self.assertEqual(unknown,4)

    def test_repository_scope_and_unconfirmed_matches(self):
        sessions=[{'project':'One','directory':'/one','branchHints':['main'],
                   'commitBranches':[{'branch':'main','hash':'1234567'}]},
                  {'project':'Two','directory':'/two','branchHints':['dev'],
                   'commitBranches':[{'branch':'dev','hash':'1234567'}]}]
        commits=[{'repository':p,'hash':'1234567abcdef','linked':[{'id':'s'}]} for p in ('/one','/two')]
        commits.append({'repository':'/one','hash':'9999999abcdef','linked':[]})
        rows,unknown=branch_totals({'sessions':sessions,'commits':commits})
        self.assertEqual([r['commits'] for r in rows],[1,1])
        self.assertEqual(unknown,0)

if __name__=='__main__': unittest.main()
