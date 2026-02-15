export default function CompatibilityScore({ score }) {
  const color = score > 75 ? 'text-green-600' : score > 50 ? 'text-amber-600' : 'text-rose-600';
  return (
    <p className="font-semibold">
      Compatibility: <span className={color}>{score}%</span>
    </p>
  );
}
