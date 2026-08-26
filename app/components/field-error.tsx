/** Inline error message for a form field, styled per the brand error tokens. */
function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <p role="alert" className="text-sm font-medium text-bb-error">
      {message}
    </p>
  );
}

export { FieldError };
