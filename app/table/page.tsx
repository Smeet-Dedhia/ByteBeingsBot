import { workflowGraph } from '@/lib/graph';
import ApproveButton from './ApproveButton';

export const dynamic = 'force-dynamic'; // Ensure Next.js never caches this route statically

interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function TablePage({ searchParams }: PageProps) {
  // Await searchParams before using its properties in Next.js 15+
  const sp = await searchParams;
  const threadId = typeof sp?.threadId === 'string' ? sp.threadId : null;

  if (!threadId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#07050e] text-slate-300 font-sans p-6 text-center">
        <span className="text-4xl mb-4">⚠️</span>
        <h1 className="text-lg font-bold mb-2">Missing Thread ID</h1>
        <p className="text-sm text-slate-400 max-w-xs mb-6">No threadId parameter provided in URL.</p>
      </div>
    );
  }

  try {
    const state = await workflowGraph.getState({ configurable: { thread_id: threadId } });
    
    if (!state || !state.values || Object.keys(state.values).length === 0 || !state.values.extractedData) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#07050e] text-slate-300 font-sans p-6 text-center">
          <span className="text-4xl mb-4">⚠️</span>
          <h1 className="text-lg font-bold mb-2">Could Not Load Data</h1>
          <p className="text-sm text-slate-400 max-w-xs mb-6">No active extraction data found. Please trigger a new workflow in Telegram.</p>
        </div>
      );
    }

    const { extractedData, workflowType, notionSchema } = state.values;
    const { summary, confidence } = extractedData;
    const rawRows = extractedData.rows || (extractedData as any).tasks?.map((t: string) => ({ Task: t })) || [];
    const rows = Array.isArray(rawRows) ? rawRows : [];
    
    const schema = notionSchema || {};
    const columns = Object.keys(schema).length > 0 ? Object.keys(schema) : ['Task'];

    return (
      <div className="min-h-screen text-slate-300 font-sans p-4 pb-24 bg-[#07050e]">
        {/* Header */}
        <div className="mb-6 flex justify-between items-start">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-indigo-400 font-bold">Review Extracted Info</span>
            <h1 className="text-xl font-extrabold capitalize text-white">{(workflowType || 'Unknown').replace('_', ' ')}</h1>
          </div>
          <span className="text-xs px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full font-bold">
            {confidence || 0}% Match
          </span>
        </div>

        {/* Summary */}
        <div className="mb-6 p-4 rounded-xl bg-slate-900/40 border border-slate-800/40">
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Summary</h2>
          <p className="text-sm text-slate-300 leading-relaxed font-medium">{summary}</p>
        </div>

        {/* Horizontally Scrollable Table */}
        <div className="rounded-xl border border-slate-800/60 bg-slate-950/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b border-slate-800/50 bg-slate-900/20">
                  {columns.map((col) => (
                    <th key={col} className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-800/30 hover:bg-slate-900/10">
                    {columns.map((col) => {
                      const val = row[col];
                      return (
                        <td key={col} className="p-3 text-xs text-slate-300 font-medium">
                          {val === undefined || val === null || val === '' ? (
                            <span className="text-slate-600 font-mono">—</span>
                          ) : (
                            <span>{String(val)}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Approve Button Client Component */}
        <ApproveButton threadId={threadId} />
      </div>
    );
  } catch (error: any) {
    console.error("Error rendering table server component:", error);
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#07050e] text-slate-300 font-sans p-6 text-center">
        <span className="text-4xl mb-4">❌</span>
        <h1 className="text-lg font-bold mb-2">Server Error</h1>
        <p className="text-sm text-slate-400 max-w-xs mb-6">{error.message || 'Failed to load state'}</p>
      </div>
    );
  }
}
