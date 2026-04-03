export function TerminalPane({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  return (
    <section className="panel terminal-panel">
      <div className="panel-header">
        <h3>{title}</h3>
      </div>
      <pre className="terminal-pane">{content || "Chưa có đầu ra."}</pre>
    </section>
  );
}
