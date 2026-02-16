const styleMap = {
  searching: 'bg-slate-200 text-slate-700',
  matched: 'bg-indigo-100 text-indigo-700',
  driver_accepted: 'bg-blue-100 text-blue-700',
  on_the_way: 'bg-amber-100 text-amber-800',
  started: 'bg-green-100 text-green-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700',
};

export default function StatusBadge({ status }) {
  if (!status) return null;
  return (
    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${styleMap[status] || styleMap.searching}`}>
      {status.replaceAll('_', ' ')}
    </span>
  );
}
