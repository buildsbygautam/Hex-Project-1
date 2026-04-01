import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { Clock, ShieldAlert, CheckCircle2, AlertTriangle, Shield, Trash2 } from 'lucide-react';

interface ScanRecord {
  id: string;
  target: string;
  risk_score: number;
  verdict: string;
  created_at: string;
}

interface ScanHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | undefined;
}

export default function ScanHistory({ open, onOpenChange, userId }: ScanHistoryProps) {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && userId) {
      loadHistory();
    }
  }, [open, userId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('scan_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (error) {
        // Table might not exist yet, that's fine
        console.warn('Could not load history:', error);
      } else if (data) {
        setScans(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getVerdictIcon = (verdict: string) => {
    if (verdict.includes('MALICIOUS') || verdict.includes('CRITICAL')) return <ShieldAlert className="text-red-500 h-4 w-4" />;
    if (verdict.includes('SUSPICIOUS') || verdict.includes('HIGH')) return <AlertTriangle className="text-orange-500 h-4 w-4" />;
    return <CheckCircle2 className="text-green-500 h-4 w-4" />;
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-red-500 font-bold';
    if (score >= 40) return 'text-orange-500 font-bold';
    if (score >= 20) return 'text-yellow-500 font-bold';
    return 'text-green-500 font-bold';
  };

  const clearHistory = async () => {
    if (!userId) return;
    try {
      await supabase.from('scan_history').delete().eq('user_id', userId);
      setScans([]);
    } catch (err) {
      console.error('Failed to clear history', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-green-500/30 text-green-400 max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Threat Intelligence History
          </DialogTitle>
          {scans.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={clearHistory}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-8"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          )}
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto mt-4 rounded-md border border-gray-800 bg-black/50">
          {loading ? (
            <div className="flex justify-center items-center h-full text-green-500/50">Loading scan history...</div>
          ) : scans.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Shield className="h-12 w-12 mb-2 opacity-20" />
              <p>No scans recorded yet.</p>
              <p className="text-xs mt-1 opacity-50">Scans will appear here after analysis completes.</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-400 uppercase bg-gray-800/50 sticky top-0">
                <tr>
                  <th className="px-6 py-3">Target</th>
                  <th className="px-6 py-3">Score</th>
                  <th className="px-6 py-3">Verdict</th>
                  <th className="px-6 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {scans.map((scan) => (
                  <tr key={scan.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-gray-300">{scan.target}</td>
                    <td className="px-6 py-4">
                      <span className={getScoreColor(scan.risk_score)}>
                        {scan.risk_score}/100
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getVerdictIcon(scan.verdict)}
                        <span className="text-gray-300">{scan.verdict}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                      {new Date(scan.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
