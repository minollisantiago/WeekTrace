import unittest
from generate import intervals, merge, hours, split_days, safe_json, TZ
import datetime as dt, json

class TimingTests(unittest.TestCase):
    def test_overlaps(self):
        self.assertEqual(merge([(0,10),(5,20),(20,30),(50,60)]),[(0,30),(50,60)])
        self.assertEqual(hours([(0,3600000),(1800000,5400000)]),1.5)
    def test_gap_and_isolated(self):
        self.assertEqual(intervals([0,1800000,3600001],0,4000000),[(0,1800000),(3600001,3600001)])
        self.assertEqual(hours([(10,10)]),0)
    def test_clipped_boundary(self):
        self.assertEqual(intervals([-100,100,900,1100],0,1000),[(0,1000)])
        self.assertEqual(intervals([1000],0,1000),[])
    def test_midnight(self):
        a=dt.datetime(2026,10,5,23,50,tzinfo=TZ).timestamp()*1000
        b=a+20*60000
        parts=split_days(a,b)
        self.assertEqual(len(parts),2)
        self.assertEqual([y-x for x,y in parts],[600000,600000])
        self.assertEqual(hours(parts),1/3)
    def test_script_escaping(self):
        value={'prompt':'</script><img src=x onerror=alert(1)>&\u2028'}
        encoded=safe_json(value)
        self.assertNotIn('<',encoded)
        self.assertEqual(json.loads(encoded),value)

if __name__=='__main__': unittest.main()
