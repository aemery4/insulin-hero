import { DISCLAIMER } from '../../domain/explanations';

export function Disclaimer({ childName }: { childName: string }) {
  return (
    <p className="disclaimer" role="note">
      <span aria-hidden="true">📘 </span>
      {DISCLAIMER(childName)}
    </p>
  );
}
