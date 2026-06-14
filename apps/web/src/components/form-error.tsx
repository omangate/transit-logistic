'use client';

type FormErrorProps = {
  message: string | null;
};

export function FormError({ message }: FormErrorProps) {
  if (!message) {
    return null;
  }

  return (
    <div
      role="alert"
      style={{
        background: '#fef2f2',
        border: '1px solid #fecaca',
        color: '#991b1b',
        borderRadius: '0.5rem',
        padding: '0.75rem 1rem',
        marginBlockEnd: '1rem',
        fontSize: '0.875rem',
      }}
    >
      {message}
    </div>
  );
}
