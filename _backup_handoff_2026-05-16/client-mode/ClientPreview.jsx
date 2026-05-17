import ClientMode from './ClientMode';

export default function ClientPreview() {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#000' }}>
      <ClientMode />
    </div>
  );
}
