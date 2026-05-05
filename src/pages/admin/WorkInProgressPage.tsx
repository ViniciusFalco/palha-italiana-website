type WorkInProgressPageProps = {
  tabName: string;
};

export default function WorkInProgressPage({ tabName }: WorkInProgressPageProps) {
  return (
    <div className="admin-page">
      <section className="admin-section admin-dev-progress">
        <h1 className="admin-section-title">{tabName}</h1>
        <p className="admin-section-helper">Aba em desenvolvimento.</p>
        <img
          className="admin-dev-progress-image"
          src="/dev_progress.svg"
          alt={`Ilustracao da aba ${tabName} em desenvolvimento`}
          loading="lazy"
        />
      </section>
    </div>
  );
}
