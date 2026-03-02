export default function CompatibilityScore({ score, reasons = [] }) {
  const color = score > 75 ? 'text-green-600' : score > 50 ? 'text-amber-600' : 'text-rose-600';

  return (
    <div className="space-y-1">
      <p className="font-semibold">
        Compatibility: <span className={color}>{score}%</span>
      </p>
      {reasons.length > 0 && (
        <ul className="text-xs text-slate-600 list-disc list-inside">
          {reasons.map((reason) => (
            <li key={reason}>✔ {reason}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
