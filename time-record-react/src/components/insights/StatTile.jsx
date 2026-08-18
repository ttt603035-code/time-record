/** Small labelled value tile — shared by the More screen and Task detail. */
export function StatTile({ label, value, title }) {
  return (
    <div className="stat-tile" title={title}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}
