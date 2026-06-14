type LoadingStateProps = {
  message: string;
};

export function LoadingState({ message }: LoadingStateProps) {
  return (
    <main className="portal-loading">
      <p>{message}</p>
    </main>
  );
}
